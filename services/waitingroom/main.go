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

type JoinRequest struct {
	UserID  string `json:"user_id" binding:"required"`
	EventID string `json:"event_id" binding:"required"`
}

func queueKey(eventID string) string {
	return "ticket_queue:" + eventID
}

func setupRouter(rdb *redis.Client) *gin.Engine {
	ctx := context.Background()
	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		if _, err := rdb.Ping(ctx).Result(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "waitingroom"})
	})

	router.POST("/queue/join", func(c *gin.Context) {
		var req JoinRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id and event_id are required"})
			return
		}

		score := float64(time.Now().UnixMilli())
		err := rdb.ZAddNX(ctx, queueKey(req.EventID), redis.Z{
			Score:  score,
			Member: req.UserID,
		}).Err()
		if err != nil {
			log.Printf("Redis error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join queue"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Successfully joined the waiting room",
			"user_id":  req.UserID,
			"event_id": req.EventID,
		})
	})

	router.POST("/queue/leave", func(c *gin.Context) {
		var req JoinRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id and event_id are required"})
			return
		}

		if err := rdb.ZRem(ctx, queueKey(req.EventID), req.UserID).Err(); err != nil {
			log.Printf("Redis error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave queue"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Left queue successfully", "user_id": req.UserID})
	})

	router.GET("/queue/status", func(c *gin.Context) {
		userID := c.Query("user_id")
		eventID := c.Query("event_id")
		if userID == "" || eventID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id and event_id query parameters are required"})
			return
		}

		rank, err := rdb.ZRank(ctx, queueKey(eventID), userID).Result()
		if err == redis.Nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User is not in the queue"})
			return
		} else if err != nil {
			log.Printf("Redis error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get queue status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"user_id":  userID,
			"position": rank + 1,
		})
	})

	return router
}

func main() {
	fmt.Println("Starting Waiting Room Service...")

	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisHost, "6379"),
		Password: "",
		DB:       0,
	})

	ctx := context.Background()
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	fmt.Println("✅ Successfully connected to Redis!")

	router := setupRouter(rdb)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Waiting Room Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
