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

// 1. Define the Ticket model
type Ticket struct {
	ID         int    `json:"id"`
	EventID    int    `json:"event_id"`
	SeatName   string `json:"seat_name"`
	IsReserved bool   `json:"is_reserved"`
}

type ReserveRequest struct {
	// "binding:required" tells Gin to reject the request if this field is missing
	TicketID int `json:"ticket_id" binding:"required"`
}

func main() {
	fmt.Println("Starting Inventory Service...")

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbUser := "ticket_admin"
	dbPassword := "secure_password_123"
	dbName := "ticket_db"

	connStr := fmt.Sprintf("host=%s port=5432 user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbUser, dbPassword, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Error opening database connection: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("Could not connect to the database: %v", err)
	}
	fmt.Println("✅ Successfully connected to PostgreSQL!")

	router := gin.Default()

	// Healthcheck endpoint
	router.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "inventory"})
	})

	// 2. NEW ENDPOINT: Get all tickets
	router.GET("/tickets", func(c *gin.Context) {
		// Query the database
		rows, err := db.Query("SELECT id, event_id, seat_name, is_reserved FROM tickets")
		if err != nil {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tickets"})
			return
		}
		defer rows.Close() // Always defer closing rows to prevent memory leaks

		var tickets []Ticket

		// Loop through the results and map them to our struct
		for rows.Next() {
			var t Ticket
			if err := rows.Scan(&t.ID, &t.EventID, &t.SeatName, &t.IsReserved); err != nil {
				log.Printf("Row scan error: %v", err)
				continue
			}
			tickets = append(tickets, t)
		}

		// Return the JSON response
		c.JSON(http.StatusOK, tickets)
	})

	// 3. NEW ENDPOINT: Reserve a ticket
	router.POST("/tickets/reserve", func(c *gin.Context) {
		var req ReserveRequest

		// Bind the incoming JSON to our struct
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload. 'ticket_id' is required."})
			return
		}

		// The Magic Query: We ONLY update if is_reserved is currently false.
		// PostgreSQL guarantees this operation is atomic, preventing double-bookings.
		result, err := db.Exec("UPDATE tickets SET is_reserved = true WHERE id = $1 AND is_reserved = false", req.TicketID)
		if err != nil {
			log.Printf("Database error during reservation: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}

		// Check if the row was actually updated
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify reservation status"})
			return
		}

		if rowsAffected == 0 {
			// If 0 rows were updated, it means the ticket was either already reserved OR doesn't exist
			c.JSON(http.StatusConflict, gin.H{"error": "Ticket is already reserved or does not exist"})
			return
		}

		// Success!
		c.JSON(http.StatusOK, gin.H{
			"message":   "Ticket successfully reserved!",
			"ticket_id": req.TicketID,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Inventory Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
