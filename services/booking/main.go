package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-resty/resty/v2"
)

type BookTicketRequest struct {
	UserID   string `json:"user_id" binding:"required"`
	TicketID int    `json:"ticket_id" binding:"required"`
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

		// --- STEP B: Verify user is in the Waiting Room ---
		fmt.Printf("Token valid. Verifying user %s is in the queue...\n", req.UserID)
		queueResp, err := client.R().
			SetQueryParam("user_id", req.UserID).
			Get(waitingRoomURL + "/queue/status")

		if err != nil || queueResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusForbidden, gin.H{"error": "User is not in the waiting room queue"})
			return
		}

		// --- STEP C: Call Inventory to Reserve the Seat ---
		fmt.Printf("User verified in queue. Attempting to reserve ticket %d...\n", req.TicketID)
		reserveResp, err := client.R().
			SetBody(map[string]interface{}{
				"ticket_id": req.TicketID,
				"owner_id":  req.UserID,
			}).
			Post(inventoryURL + "/tickets/reserve")

		if err != nil {
			log.Printf("Failed to call inventory: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Inventory service unavailable"})
			return
		}

		if reserveResp.StatusCode() == http.StatusConflict {
			c.JSON(http.StatusConflict, gin.H{"error": "Sorry, this ticket was just taken!"})
			return
		} else if reserveResp.StatusCode() != http.StatusOK {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reserve ticket"})
			return
		}

		// Success!
		c.JSON(http.StatusOK, gin.H{
			"message":   "Booking successful!",
			"user_id":   req.UserID,
			"ticket_id": req.TicketID,
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
