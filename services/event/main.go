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
	Time        string `json:"time"`
	Date        string `json:"date"`
	Location    string `json:"location"`
	Address     string `json:"address"`
	TotalSpaces int    `json:"total_spaces"`
	ImageUrl    string `json:"image_url"`
	MapUrl      string `json:"map_url"`
	Description string `json:"description"`
	Category    string `json:"category"`
	MinPrice    int    `json:"min_price"`
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
		categoryQuery := c.Query("category")
		var rows *sql.Rows
		var dbErr error

		baseSelect := `SELECT e.id, e.name, COALESCE(e.time, ''), TO_CHAR(e.date, 'YYYY-MM-DD'), e.location, COALESCE(e.address, ''), e.total_spaces, COALESCE(e.image_url, ''), COALESCE(e.map_url, ''), COALESCE(e.description, ''), COALESCE(e.category, 'Khác'), COALESCE(MIN(ez.price), 0)
			FROM events e LEFT JOIN event_zones ez ON ez.event_id = e.id`

		if searchQuery != "" && categoryQuery != "" {
			rows, dbErr = db.Query(baseSelect+" WHERE (e.name ILIKE $1 OR e.location ILIKE $1) AND e.category = $2 GROUP BY e.id ORDER BY e.id ASC", "%"+searchQuery+"%", categoryQuery)
		} else if searchQuery != "" {
			rows, dbErr = db.Query(baseSelect+" WHERE e.name ILIKE $1 OR e.location ILIKE $1 GROUP BY e.id ORDER BY e.id ASC", "%"+searchQuery+"%")
		} else if categoryQuery != "" {
			rows, dbErr = db.Query(baseSelect+" WHERE e.category = $1 GROUP BY e.id ORDER BY e.id ASC", categoryQuery)
		} else {
			rows, dbErr = db.Query(baseSelect + " GROUP BY e.id ORDER BY e.id ASC")
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
			if err := rows.Scan(&ev.ID, &ev.Name, &ev.Time, &ev.Date, &ev.Location, &ev.Address, &ev.TotalSpaces, &ev.ImageUrl, &ev.MapUrl, &ev.Description, &ev.Category, &ev.MinPrice); err != nil {
				log.Printf("Row scan error: %v", err)
				continue
			}
			events = append(events, ev)
		}

		if len(events) == 0 {
			events = []Event{}
		}

		c.JSON(http.StatusOK, events)
	})

	// 2. ENDPOINT: Get a specific event by ID (for the event details page)
	router.GET("/events/:id", func(c *gin.Context) {
		idParam := c.Param("id")

		query := "SELECT id, name, COALESCE(time, ''), TO_CHAR(date, 'YYYY-MM-DD'), location, COALESCE(address, ''), total_spaces, COALESCE(image_url, ''), COALESCE(map_url, ''), COALESCE(description, ''), COALESCE(category, 'Khác') FROM events WHERE id = $1"
		row := db.QueryRow(query, idParam)

		var ev Event
		err := row.Scan(&ev.ID, &ev.Name, &ev.Time, &ev.Date, &ev.Location, &ev.Address, &ev.TotalSpaces, &ev.ImageUrl, &ev.MapUrl, &ev.Description, &ev.Category)
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

	// 3. ENDPOINT: Get event zones by Event ID
	router.GET("/events/:id/zones", func(c *gin.Context) {
		idParam := c.Param("id")

		type EventZone struct {
			ID          int    `json:"id"`
			EventID     int    `json:"event_id"`
			Name        string `json:"name"`
			Capacity    int    `json:"capacity"`
			Price       int    `json:"price"`
			Description string `json:"description"`
		}

		query := "SELECT id, event_id, name, capacity, price, description FROM event_zones WHERE event_id = $1 ORDER BY price DESC"
		rows, err := db.Query(query, idParam)
		if err != nil {
			log.Printf("DB error fetching zones: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer rows.Close()

		var zones []EventZone
		for rows.Next() {
			var z EventZone
			if err := rows.Scan(&z.ID, &z.EventID, &z.Name, &z.Capacity, &z.Price, &z.Description); err != nil {
				log.Printf("Row scan error: %v", err)
				continue
			}
			zones = append(zones, z)
		}

		if len(zones) == 0 {
			zones = []EventZone{}
		}

		c.JSON(http.StatusOK, zones)
	})

	port := os.Getenv("PORT")
// 4. ENDPOINT: Create a new event with zones and auto-generate tickets
router.POST("/events", func(c *gin.Context) {
type CreateZoneRequest struct {
Name        string `json:"name"`
Capacity    int    `json:"capacity"`
Price       int    `json:"price"`
Description string `json:"description"`
}
type CreateEventRequest struct {
Name        string              `json:"name"`
Date        string              `json:"date"`
Location    string              `json:"location"`
ImageUrl    string              `json:"image_url"`
Description string              `json:"description"`
Zones       []CreateZoneRequest `json:"zones"`
}

var req CreateEventRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
return
}

// Calculate total capacity from zones
totalSpaces := 0
for _, z := range req.Zones {
totalSpaces += z.Capacity
}

tx, err := db.Begin()
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
return
}

// 1. Insert Event
var newEventID int
err = tx.QueryRow(`
INSERT INTO events (name, date, location, total_spaces, image_url, description) 
VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			req.Name, req.Date, req.Location, totalSpaces, req.ImageUrl, req.Description,
).Scan(&newEventID)

if err != nil {
tx.Rollback()
log.Printf("Insert event error: %v", err)
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create event"})
return
}

// 2. Insert Zones & 3. Auto-generate tickets
for _, z := range req.Zones {
var newZoneID int
err = tx.QueryRow(`
INSERT INTO event_zones (event_id, name, capacity, price, description) 
VALUES ($1, $2, $3, $4, $5) RETURNING id`,
newEventID, z.Name, z.Capacity, z.Price, z.Description,
).Scan(&newZoneID)

if err != nil {
tx.Rollback()
log.Printf("Insert zone error: %v", err)
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create event zones"})
return
}

// Auto-generate tickets for the zone
_, err = tx.Exec(`
INSERT INTO tickets (event_id, zone_id, seat_name, is_reserved)
SELECT $1, $2, $3 || '_' || i, false 
FROM generate_series(1, $4) AS i`,
newEventID, newZoneID, z.Name, z.Capacity,
)

if err != nil {
tx.Rollback()
log.Printf("Generate tickets error: %v", err)
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tickets"})
return
}
}

if err := tx.Commit(); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction commit failed"})
return
}

c.JSON(http.StatusCreated, gin.H{
"message":  "Event and tickets generated successfully",
"event_id": newEventID,
})
})
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Event Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
