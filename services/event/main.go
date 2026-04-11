package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// Define the Event model
type Event struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Date        string `json:"date"`
	Location    string `json:"location"`
	TotalSpaces int    `json:"total_spaces"`
}

// In-memory database for FlashTicket events
var events = []Event{
	{ID: 1, Name: "The Eras Tour - Local Edition", Date: "2026-05-15", Location: "Stadium A", TotalSpaces: 5000},
	{ID: 2, Name: "Tech Conference 2026", Date: "2026-06-20", Location: "Convention Center", TotalSpaces: 1000},
	{ID: 3, Name: "Indie Rock Night", Date: "2026-07-05", Location: "Underground Club", TotalSpaces: 200},
}

func main() {
	fmt.Println("Starting Event Service...")

	router := gin.Default()

	// Healthcheck
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "event"})
	})

	// 1. ENDPOINT: Get all events (for the frontend homepage) with optional search filter
	router.GET("/events", func(c *gin.Context) {
		searchQuery := c.Query("search")
		if searchQuery != "" {
			searchQuery = strings.ToLower(searchQuery)
			var filteredEvents []Event
			for _, event := range events {
				// Search by Name or Location
				if strings.Contains(strings.ToLower(event.Name), searchQuery) ||
					strings.Contains(strings.ToLower(event.Location), searchQuery) {
					filteredEvents = append(filteredEvents, event)
				}
			}
			c.JSON(http.StatusOK, filteredEvents)
			return
		}
		c.JSON(http.StatusOK, events)
	})

	// 2. ENDPOINT: Get a specific event by ID (for the event details page)
	router.GET("/events/:id", func(c *gin.Context) {
		idParam := c.Param("id")

		// Simple search through our slice
		for _, event := range events {
			if fmt.Sprintf("%d", event.ID) == idParam {
				c.JSON(http.StatusOK, event)
				return
			}
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Event Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
