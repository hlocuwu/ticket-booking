package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
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

		// Format ticket IDs: [101, 102, 103] → "#101, #102, #103"
		ticketLabels := make([]string, len(req.TicketIDs))
		for i, id := range req.TicketIDs {
			ticketLabels[i] = "#" + strconv.Itoa(id)
		}
		ticketIDStr := strings.Join(ticketLabels, ", ")

		// Format amount with thousand separators: 1200000 → "1.200.000"
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

		emailBody := fmt.Sprintf(`
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">

  <div style="background-color:#2ecc71;padding:28px;text-align:center;">
    <div style="font-size:48px;">🎉</div>
    <h2 style="margin:10px 0 4px;color:#ffffff;font-size:22px;">Đặt vé thành công!</h2>
    <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Cảm ơn bạn đã sử dụng FlashTicket</p>
  </div>

  <div style="padding:28px;background:#ffffff;color:#333333;">
    <p style="margin:0 0 16px;">Chào <strong>%s</strong>,</p>
    <p style="margin:0 0 20px;color:#555;">Chúng tôi xác nhận bạn đã đặt vé thành công. Dưới đây là thông tin chi tiết đơn hàng:</p>

    <div style="background:#f8fffe;border:1px solid #c8f0dc;border-radius:10px;padding:20px;margin-bottom:24px;">
      <table style="width:100%%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;color:#777;font-size:14px;border-bottom:1px solid #e4f5ec;">Mã đơn hàng</td>
          <td style="padding:10px 0;text-align:right;font-weight:bold;font-size:13px;border-bottom:1px solid #e4f5ec;">%s</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#777;font-size:14px;border-bottom:1px solid #e4f5ec;">Sự kiện</td>
          <td style="padding:10px 0;text-align:right;font-weight:bold;color:#27ae60;border-bottom:1px solid #e4f5ec;">%s</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#777;font-size:14px;border-bottom:1px solid #e4f5ec;">Số lượng vé</td>
          <td style="padding:10px 0;text-align:right;font-weight:bold;border-bottom:1px solid #e4f5ec;">%d vé</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#777;font-size:14px;border-bottom:1px solid #e4f5ec;">Mã vé</td>
          <td style="padding:10px 0;text-align:right;font-size:13px;color:#555;border-bottom:1px solid #e4f5ec;">%s</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#777;font-size:14px;border-bottom:1px solid #e4f5ec;">Thời gian mua</td>
          <td style="padding:10px 0;text-align:right;font-size:13px;border-bottom:1px solid #e4f5ec;">%s</td>
        </tr>
        <tr>
          <td style="padding:14px 0 0;font-size:16px;font-weight:bold;">Tổng tiền</td>
          <td style="padding:14px 0 0;text-align:right;font-size:22px;font-weight:bold;color:#2ecc71;">%s đ</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="http://localhost:3000/my-tickets"
         style="background-color:#2ecc71;color:#ffffff;padding:13px 36px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block;">
        Xem vé của tôi
      </a>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 4px;">Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ đội ngũ hỗ trợ.</p>
    <p style="margin:0;">Trân trọng,<br><strong>Đội ngũ FlashTicket</strong></p>
  </div>

  <div style="background:#f5f5f5;padding:14px;text-align:center;font-size:12px;color:#aaa;">
    &copy; 2026 FlashTicket. Tất cả các quyền được bảo lưu.
  </div>

</div>
`, req.UserID, req.OrderID, req.EventName, len(req.TicketIDs), ticketIDStr, purchaseTime, amountStr)

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
