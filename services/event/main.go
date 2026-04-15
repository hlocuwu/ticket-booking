package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// Define the Event model
type Event struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Date        string `json:"date"`
	Location    string `json:"location"`
	TotalSpaces int    `json:"total_spaces"`
}

func main() {
	fmt.Println("Starting Event Service...")

	// Connect to Database
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost" // Fallback for local testing
	}
	dbUser := "ticket_admin"
	dbPassword := "secure_password_123"
	dbName := "ticket_db"

	connStr := fmt.Sprintf("host=%s port=5432 user=%s password=%s dbname=%s sslmode=disable", dbHost, dbUser, dbPassword, dbName)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Database is unreachable: %v", err)
	}
	fmt.Println("✅ Successfully connected to internal Database!")

	router := gin.Default()

	// Healthcheck
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "event"})
	})

	// 1. ENDPOINT: Get all events (for the frontend homepage) with optional search filter
	router.GET("/events", func(c *gin.Context) {
		searchQuery := c.Query("search")
		var query string
		var rows *sql.Rows
		var dbErr error

		if searchQuery != "" {
			query = "SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD') as date, location, total_spaces FROM events WHERE ILIKE($1) OR ILIKE($2) ORDER BY id ASC" // Wait ILIKE requires column names
			// Correcting SQL query...
			query = "SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD'), location, total_spaces FROM events WHERE name ILIKE $1 OR location ILIKE $1 ORDER BY id ASC"
			wildcardSearch := "%" + searchQuery + "%"
			rows, dbErr = db.Query(query, wildcardSearch)
		} else {
			query = "SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD'), location, total_spaces FROM events ORDER BY id ASC"
			rows, dbErr = db.Query(query)
		}

		if dbErr != nil {
			log.Printf("Query error: %v", dbErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch events from database"})
			return
		}
		defer rows.Close()

		var events []Event
		for rows.Next() {
			var ev Event
			if err := rows.Scan(&ev.ID, &ev.Name, &ev.Date, &ev.Location, &ev.TotalSpaces); err != nil {
				log.Printf("Row scan error: %v", err)
				continue
			}
			events = append(events, ev)
		}

		if len(events) == 0 {
			events = []Event{} // Return empty array instead of null
		}

		c.JSON(http.StatusOK, events)
	})

	// 2. ENDPOINT: Get a specific event by ID (for the event details page)
	router.GET("/events/:id", func(c *gin.Context) {
		idParam := c.Param("id")

		query := "SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD'), location, total_spaces FROM events WHERE id = $1"
		row := db.QueryRow(query, idParam)

		var ev Event
		err := row.Scan(&ev.ID, &ev.Name, &ev.Date, &ev.Location, &ev.TotalSpaces)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
				return
			}
			log.Printf("DB error fetching event: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		c.JSON(http.StatusOK, ev)
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
