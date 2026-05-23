package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-resty/resty/v2"
	"github.com/redis/go-redis/v9"
)

var bgCtx = context.Background()

const orderTTL = 12 * time.Minute

type BookTicketRequest struct {
	UserID        string `json:"user_id" binding:"required"`
	EventID       string `json:"event_id" binding:"required"`
	TicketIDs     []int  `json:"ticket_ids" binding:"required"`
	Amount        int    `json:"amount" binding:"required"`
	ReturnURL     string `json:"return_url" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

type ConfirmPaymentRequest struct {
	OrderID   string `json:"order_id" binding:"required"`
	UserID    string `json:"user_id" binding:"required"`
	UserEmail string `json:"user_email" binding:"required"`
	TicketIDs []int  `json:"ticket_ids" binding:"required"`
	EventName string `json:"event_name" binding:"required"`
	Amount    int    `json:"amount" binding:"required"`
}

type Services struct {
	InventoryURL    string
	WaitingRoomURL  string
	AuthURL         string
	PaymentURL      string
	NotificationURL string
	AppPublicURL    string
}

func markOrderConfirmed(rdb *redis.Client, orderID string) {
	rdb.Set(bgCtx, "order:confirmed:"+orderID, "1", orderTTL)
}

func isOrderConfirmed(rdb *redis.Client, orderID string) bool {
	val, err := rdb.Exists(bgCtx, "order:confirmed:"+orderID).Result()
	return err == nil && val > 0
}

func setupRouter(rdb *redis.Client, svc Services) *gin.Engine {
	client := resty.New()
	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "booking"})
	})

	router.POST("/book", func(c *gin.Context) {
		var req BookTicketRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		authResp, err := client.R().
			SetHeader("Authorization", authHeader).
			Post(svc.AuthURL + "/verify")

		if err != nil {
			log.Printf("Failed to call auth service: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Auth service unavailable"})
			return
		}

		if authResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token. Please log in again."})
			return
		}

		queueResp, err := client.R().
			SetQueryParam("user_id", req.UserID).
			SetQueryParam("event_id", req.EventID).
			Get(svc.WaitingRoomURL + "/queue/status")

		if err != nil || queueResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusForbidden, gin.H{"error": "User is not in the waiting room queue"})
			return
		}

		var queueStatus struct {
			Position int64 `json:"position"`
		}
		if jsonErr := json.Unmarshal(queueResp.Body(), &queueStatus); jsonErr != nil || queueStatus.Position > 1 {
			c.JSON(http.StatusForbidden, gin.H{"error": "It's not your turn yet. Please wait in the queue."})
			return
		}

		reserveResp, err := client.R().
			SetBody(map[string]interface{}{
				"ticket_ids": req.TicketIDs,
				"owner_id":   req.UserID,
			}).
			Post(svc.InventoryURL + "/tickets/reserve-batch")

		if err != nil {
			log.Printf("Failed to call inventory: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Inventory service unavailable"})
			return
		}

		if reserveResp.StatusCode() == http.StatusConflict {
			c.JSON(http.StatusConflict, gin.H{"error": "Sorry, one or more tickets were just taken!"})
			return
		} else if reserveResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reserve tickets"})
			return
		}

		orderID := fmt.Sprintf("ORD-%d", time.Now().UnixMilli())
		paymentEndpoint := "/create-payment"
		if req.PaymentMethod == "mock" {
			paymentEndpoint = "/create-mock-payment"
		}

		go func(oid string, tids []int, ownerID string) {
			time.Sleep(10 * time.Minute)
			if !isOrderConfirmed(rdb, oid) {
				log.Printf("Order %s expired without confirmation. Rolling back tickets %v", oid, tids)
				_, rollbackErr := client.R().
					SetBody(map[string]interface{}{
						"ticket_ids": tids,
						"owner_id":   ownerID,
					}).
					Post(svc.InventoryURL + "/tickets/rollback-batch")
				if rollbackErr != nil {
					log.Printf("CRITICAL: Failed to rollback expired order %s: %v", oid, rollbackErr)
				}
			}
		}(orderID, req.TicketIDs, req.UserID)

		paymentResp, err := client.R().
			SetBody(map[string]interface{}{
				"orderId":   orderID,
				"amount":    req.Amount,
				"returnUrl": req.ReturnURL,
			}).
			Post(svc.PaymentURL + paymentEndpoint)

		if err != nil || paymentResp.StatusCode() != http.StatusOK {
			log.Printf("Failed to call payment service: %v", err)
			markOrderConfirmed(rdb, orderID)
			_, rollbackErr := client.R().
				SetBody(map[string]interface{}{
					"ticket_ids": req.TicketIDs,
					"owner_id":   req.UserID,
				}).
				Post(svc.InventoryURL + "/tickets/rollback-batch")
			if rollbackErr != nil {
				log.Printf("CRITICAL: Failed to rollback tickets %v: %v", req.TicketIDs, rollbackErr)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Payment service unavailable, reservation cancelled"})
			return
		}

		var payData map[string]interface{}
		if jsonErr := json.Unmarshal(paymentResp.Body(), &payData); jsonErr != nil {
			payData = make(map[string]interface{})
		}
		payData["order_id"] = orderID
		c.JSON(http.StatusOK, payData)
	})

	router.POST("/rollback", func(c *gin.Context) {
		var req struct {
			OrderID   string `json:"order_id" binding:"required"`
			UserID    string `json:"user_id" binding:"required"`
			TicketIDs []int  `json:"ticket_ids" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		markOrderConfirmed(rdb, req.OrderID)

		log.Printf("Manual rollback requested for order %s, tickets %v", req.OrderID, req.TicketIDs)
		_, err := client.R().
			SetBody(map[string]interface{}{
				"ticket_ids": req.TicketIDs,
				"owner_id":   req.UserID,
			}).
			Post(svc.InventoryURL + "/tickets/rollback-batch")
		if err != nil {
			log.Printf("Rollback failed for order %s: %v", req.OrderID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Rollback failed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Tickets rolled back successfully"})
	})

	router.POST("/confirm", func(c *gin.Context) {
		var req ConfirmPaymentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		markOrderConfirmed(rdb, req.OrderID)

		_, confirmErr := client.R().
			SetBody(map[string]interface{}{
				"ticket_ids": req.TicketIDs,
				"owner_id":   req.UserID,
			}).
			Post(svc.InventoryURL + "/tickets/confirm-batch")
		if confirmErr != nil {
			log.Printf("Failed to confirm tickets for order %s: %v", req.OrderID, confirmErr)
		}

		ticketLabels := make([]string, len(req.TicketIDs))
		for i, id := range req.TicketIDs {
			ticketLabels[i] = "#" + strconv.Itoa(id)
		}
		ticketIDStr := strings.Join(ticketLabels, ", ")

		amountStr := func(n int) string {
			s := strconv.Itoa(n)
			result := ""
			for i, ch := range s {
				if i > 0 && (len(s)-i)%3 == 0 {
					result += "."
				}
				result += string(ch)
			}
			return result
		}(req.Amount)

		purchaseTime := time.Now().Format("15:04 - 02/01/2006")

		emailBody := fmt.Sprintf(`<div>Order: %s | Event: %s | Tickets: %s | Amount: %s | Time: %s</div>`,
			req.OrderID, req.EventName, ticketIDStr, amountStr, purchaseTime)

		_, err := client.R().
			SetBody(map[string]interface{}{
				"to_email": req.UserEmail,
				"subject":  "Xác nhận đặt vé thành công: " + req.EventName,
				"body":     emailBody,
			}).
			Post(svc.NotificationURL + "/send-email")

		if err != nil {
			log.Printf("Failed to call notification service: %v", err)
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Payment confirmed and notification sent",
		})
	})

	return router
}

func main() {
	fmt.Println("Starting Booking Service...")

	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{Addr: redisHost})
	if err := rdb.Ping(bgCtx).Err(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	fmt.Println("✅ Booking Service connected to Redis!")

	svc := Services{
		InventoryURL:    os.Getenv("INVENTORY_URL"),
		WaitingRoomURL:  os.Getenv("WAITINGROOM_URL"),
		AuthURL:         os.Getenv("AUTH_URL"),
		PaymentURL:      os.Getenv("PAYMENT_URL"),
		NotificationURL: os.Getenv("NOTIFICATION_URL"),
		AppPublicURL:    os.Getenv("APP_PUBLIC_URL"),
	}
	if svc.InventoryURL == "" {
		svc.InventoryURL = "http://localhost:8081"
	}
	if svc.WaitingRoomURL == "" {
		svc.WaitingRoomURL = "http://localhost:8082"
	}
	if svc.AuthURL == "" {
		svc.AuthURL = "http://localhost:8085"
	}
	if svc.PaymentURL == "" {
		svc.PaymentURL = "http://localhost:8087"
	}
	if svc.NotificationURL == "" {
		svc.NotificationURL = "http://localhost:8086"
	}
	if svc.AppPublicURL == "" {
		svc.AppPublicURL = "http://localhost:3000"
	}

	router := setupRouter(rdb, svc)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Booking Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
