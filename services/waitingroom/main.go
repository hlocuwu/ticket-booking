package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// Request payload for joining the queue
type JoinRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

func main() {
	fmt.Println("Starting Waiting Room Service...")

	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}
	redisPort := "6379"

	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisHost, redisPort),
		Password: "",
		DB:       0,
	})

	ctx := context.Background()

	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	fmt.Println("✅ Successfully connected to Redis!")

	router := gin.Default()

	// Healthcheck
	router.GET("/health", func(c *gin.Context) {
		if _, err := rdb.Ping(ctx).Result(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "waitingroom"})
	})

	const queueKey = "ticket_queue"

	// 1. ENDPOINT: Join the queue
	router.POST("/queue/join", func(c *gin.Context) {
		var req JoinRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
			return
		}

		// Use the current time (in milliseconds) as the score to maintain order
		score := float64(time.Now().UnixMilli())

		// Add user to the Sorted Set. NX means "Only add if it doesn't already exist"
		// This prevents a user from losing their spot if they click "join" twice.
		err := rdb.ZAddNX(ctx, queueKey, redis.Z{
			Score:  score,
			Member: req.UserID,
		}).Err()

		if err != nil {
			log.Printf("Redis error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join queue"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Successfully joined the waiting room",
			"user_id": req.UserID,
		})
	})

	// 2. ENDPOINT: Check queue status (position)
	router.GET("/queue/status", func(c *gin.Context) {
		userID := c.Query("user_id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
			return
		}

		// ZRank gets the index of the member (0-based).
		// If they are 1st in line, rank is 0.
		rank, err := rdb.ZRank(ctx, queueKey, userID).Result()
		if err == redis.Nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User is not in the queue"})
			return
		} else if err != nil {
			log.Printf("Redis error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get queue status"})
			return
		}

		// Add 1 to make it human-readable (1st, 2nd, 3rd in line)
		position := rank + 1

		c.JSON(http.StatusOK, gin.H{
			"user_id":  userID,
			"position": position,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Waiting Room Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
