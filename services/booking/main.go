package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-resty/resty/v2"
)

var (
	confirmedOrders = make(map[string]bool)
	orderMu         sync.Mutex
)

type BookTicketRequest struct {
	UserID        string `json:"user_id" binding:"required"`
	TicketIDs     []int  `json:"ticket_ids" binding:"required"`
	Amount        int    `json:"amount" binding:"required"`
	ReturnURL     string `json:"return_url" binding:"required"`
	PaymentMethod string `json:"payment_method"` // "momo" (default) | "mock"
}

type ConfirmPaymentRequest struct {
	OrderID   string `json:"order_id" binding:"required"`
	UserID    string `json:"user_id" binding:"required"`
	UserEmail string `json:"user_email" binding:"required"`
	TicketIDs []int  `json:"ticket_ids" binding:"required"`
	EventName string `json:"event_name" binding:"required"`
	Amount    int    `json:"amount" binding:"required"`
}

func main() {
	fmt.Println("Starting Booking Service...")

	// 1. Get the internal URLs for the other microservices
	inventoryURL := os.Getenv("INVENTORY_URL")
	if inventoryURL == "" {
		inventoryURL = "http://localhost:8081"
	}

	waitingRoomURL := os.Getenv("WAITINGROOM_URL")
	if waitingRoomURL == "" {
		waitingRoomURL = "http://localhost:8082"
	}

	authURL := os.Getenv("AUTH_URL")
	if authURL == "" {
		authURL = "http://localhost:8085"
	}

	paymentURL := os.Getenv("PAYMENT_URL")
	if paymentURL == "" {
		paymentURL = "http://localhost:8087"
	}

	notificationURL := os.Getenv("NOTIFICATION_URL")
	if notificationURL == "" {
		notificationURL = "http://localhost:8086"
	}

	client := resty.New()
	router := gin.Default()

	// Healthcheck
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "booking"})
	})

	// 2. The Core Booking Endpoint (Now Secured!)
	router.POST("/book", func(c *gin.Context) {
		var req BookTicketRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// --- STEP A: Verify the JWT Token ---
		// Extract the token from the user's incoming request
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		fmt.Printf("Verifying token for booking request...\n")
		// Forward the token to the Auth Service
		authResp, err := client.R().
			SetHeader("Authorization", authHeader).
			Post(authURL + "/verify")

		if err != nil {
			log.Printf("Failed to call auth service: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Auth service unavailable"})
			return
		}

		if authResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token. Please log in again."})
			return
		}

		// --- STEP B: Verify user is in the Waiting Room at position <= 5 ---
		fmt.Printf("Token valid. Verifying user %s is in the queue...\n", req.UserID)
		queueResp, err := client.R().
			SetQueryParam("user_id", req.UserID).
			Get(waitingRoomURL + "/queue/status")

		if err != nil || queueResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusForbidden, gin.H{"error": "User is not in the waiting room queue"})
			return
		}

		var queueStatus struct {
			Position int64 `json:"position"`
		}
		if jsonErr := json.Unmarshal(queueResp.Body(), &queueStatus); jsonErr != nil || queueStatus.Position > 5 {
			c.JSON(http.StatusForbidden, gin.H{"error": "It's not your turn yet. Please wait in the queue."})
			return
		}

		// --- STEP C: Call Inventory to Reserve the Seats ---
		fmt.Printf("User verified in queue. Attempting to reserve tickets %v...\n", req.TicketIDs)
		reserveResp, err := client.R().
			SetBody(map[string]interface{}{
				"ticket_ids": req.TicketIDs,
				"owner_id":   req.UserID,
			}).
			Post(inventoryURL + "/tickets/reserve-batch")

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

		// --- STEP D: Call Payment Service ---
		orderID := fmt.Sprintf("ORD-%d", time.Now().UnixMilli())
		paymentEndpoint := "/create-payment"
		if req.PaymentMethod == "mock" {
			paymentEndpoint = "/create-mock-payment"
		}

		// Schedule auto-rollback if payment is abandoned within 10 minutes
		go func(oid string, tids []int, ownerID string) {
			time.Sleep(10 * time.Minute)
			orderMu.Lock()
			confirmed := confirmedOrders[oid]
			if confirmed {
				delete(confirmedOrders, oid)
			}
			orderMu.Unlock()

			if !confirmed {
				log.Printf("Order %s expired without confirmation. Rolling back tickets %v", oid, tids)
				_, rollbackErr := client.R().
					SetBody(map[string]interface{}{
						"ticket_ids": tids,
						"owner_id":   ownerID,
					}).
					Post(inventoryURL + "/tickets/rollback-batch")
				if rollbackErr != nil {
					log.Printf("CRITICAL: Failed to rollback expired order %s: %v", oid, rollbackErr)
				}
			}
		}(orderID, req.TicketIDs, req.UserID)
		fmt.Printf("Tickets reserved. Generating MoMo payment for order %s...\n", orderID)

		paymentResp, err := client.R().
			SetBody(map[string]interface{}{
				"orderId":   orderID,
				"amount":    req.Amount,
				"returnUrl": req.ReturnURL,
			}).
			Post(paymentURL + paymentEndpoint)

		if err != nil || paymentResp.StatusCode() != http.StatusOK {
			log.Printf("Failed to call payment service: %v", err)

			// Mark as confirmed so the goroutine does not attempt a second rollback
			orderMu.Lock()
			confirmedOrders[orderID] = true
			orderMu.Unlock()

			_, rollbackErr := client.R().
				SetBody(map[string]interface{}{
					"ticket_ids": req.TicketIDs,
					"owner_id":   req.UserID,
				}).
				Post(inventoryURL + "/tickets/rollback-batch")
			if rollbackErr != nil {
				log.Printf("CRITICAL: Failed to rollback tickets %v: %v", req.TicketIDs, rollbackErr)
			}

			c.JSON(http.StatusInternalServerError, gin.H{"error": "Payment service unavailable, reservation cancelled"})
			return
		}

		c.Data(paymentResp.StatusCode(), "application/json", paymentResp.Body())
	})

	// 3. Confirm endpoint (Called after MoMo redirects back to Frontend)
	router.POST("/confirm", func(c *gin.Context) {
		var req ConfirmPaymentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// Mark order as confirmed so the auto-rollback goroutine does not cancel it
		orderMu.Lock()
		confirmedOrders[req.OrderID] = true
		orderMu.Unlock()

		// Confirm tickets in inventory so they appear in MyTickets
		_, confirmErr := client.R().
			SetBody(map[string]interface{}{
				"ticket_ids": req.TicketIDs,
				"owner_id":   req.UserID,
			}).
			Post(inventoryURL + "/tickets/confirm-batch")
		if confirmErr != nil {
			log.Printf("Failed to confirm tickets for order %s: %v", req.OrderID, confirmErr)
		}

		fmt.Printf("Order %s confirmed. Sending email to %s...\n", req.OrderID, req.UserEmail)

		emailBody := fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
			  <h2 style="color: #2ecc71;">Thanh toán thành công!</h2>
			  <p>Chào <strong>%s</strong>,</p>
			  <p>Bạn đã mua thành công <strong>%d vé</strong> cho sự kiện <strong>%s</strong>.</p>
			  <p>Tổng tiền: %d đ</p>
			  <p>Vui lòng đăng nhập vào ứng dụng để xem chi tiết vé.</p>
			</div>
		`, req.UserID, len(req.TicketIDs), req.EventName, req.Amount)

		_, err := client.R().
			SetBody(map[string]interface{}{
				"to_email": req.UserEmail,
				"subject":  "Xác nhận đặt vé thành công: " + req.EventName,
				"body":     emailBody,
			}).
			Post(notificationURL + "/send-email")

		if err != nil {
			log.Printf("Failed to call notification service: %v", err)
			// Don't fail the request just because email failed, but log it
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Payment confirmed and notification sent",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Booking Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
