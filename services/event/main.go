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

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	connStr := fmt.Sprintf("host=%s port=5432 user=%s password=%s dbname=%s sslmode=disable",
		dbHost, "ticket_admin", "secure_password_123", "ticket_db")

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

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "event"})
	})

	// ── GET /events ─────────────────────────────────────────────────────────
	router.GET("/events", func(c *gin.Context) {
		searchQuery := c.Query("search")
		categoryQuery := c.Query("category")

		base := `SELECT e.id, e.name, COALESCE(e.time,''), TO_CHAR(e.date,'YYYY-MM-DD'), e.location,
			COALESCE(e.address,''), e.total_spaces, COALESCE(e.image_url,''), COALESCE(e.map_url,''),
			COALESCE(e.description,''), COALESCE(e.category,'Khác'), COALESCE(MIN(ez.price),0)
			FROM events e LEFT JOIN event_zones ez ON ez.event_id = e.id`

		var rows *sql.Rows
		var dbErr error
		switch {
		case searchQuery != "" && categoryQuery != "":
			rows, dbErr = db.Query(base+" WHERE (e.name ILIKE $1 OR e.location ILIKE $1) AND e.category=$2 GROUP BY e.id ORDER BY e.id", "%"+searchQuery+"%", categoryQuery)
		case searchQuery != "":
			rows, dbErr = db.Query(base+" WHERE e.name ILIKE $1 OR e.location ILIKE $1 GROUP BY e.id ORDER BY e.id", "%"+searchQuery+"%")
		case categoryQuery != "":
			rows, dbErr = db.Query(base+" WHERE e.category=$1 GROUP BY e.id ORDER BY e.id", categoryQuery)
		default:
			rows, dbErr = db.Query(base + " GROUP BY e.id ORDER BY e.id")
		}
		if dbErr != nil {
			log.Printf("Query error: %v", dbErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch events"})
			return
		}
		defer rows.Close()

		var events []Event
		for rows.Next() {
			var ev Event
			if err := rows.Scan(&ev.ID, &ev.Name, &ev.Time, &ev.Date, &ev.Location, &ev.Address,
				&ev.TotalSpaces, &ev.ImageUrl, &ev.MapUrl, &ev.Description, &ev.Category, &ev.MinPrice); err != nil {
				continue
			}
			events = append(events, ev)
		}
		if events == nil {
			events = []Event{}
		}
		c.JSON(http.StatusOK, events)
	})

	// ── GET /events/:id ──────────────────────────────────────────────────────
	router.GET("/events/:id", func(c *gin.Context) {
		var ev Event
		err := db.QueryRow(`SELECT id, name, COALESCE(time,''), TO_CHAR(date,'YYYY-MM-DD'), location,
			COALESCE(address,''), total_spaces, COALESCE(image_url,''), COALESCE(map_url,''),
			COALESCE(description,''), COALESCE(category,'Khác') FROM events WHERE id=$1`, c.Param("id")).
			Scan(&ev.ID, &ev.Name, &ev.Time, &ev.Date, &ev.Location, &ev.Address,
				&ev.TotalSpaces, &ev.ImageUrl, &ev.MapUrl, &ev.Description, &ev.Category)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		c.JSON(http.StatusOK, ev)
	})

	// ── GET /events/:id/zones ────────────────────────────────────────────────
	router.GET("/events/:id/zones", func(c *gin.Context) {
		type EventZone struct {
			ID          int    `json:"id"`
			EventID     int    `json:"event_id"`
			Name        string `json:"name"`
			Capacity    int    `json:"capacity"`
			Price       int    `json:"price"`
			Description string `json:"description"`
		}
		rows, err := db.Query(`SELECT id, event_id, name, capacity, price, COALESCE(description,'')
			FROM event_zones WHERE event_id=$1 ORDER BY price DESC`, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer rows.Close()

		var zones []EventZone
		for rows.Next() {
			var z EventZone
			if err := rows.Scan(&z.ID, &z.EventID, &z.Name, &z.Capacity, &z.Price, &z.Description); err != nil {
				continue
			}
			zones = append(zones, z)
		}
		if zones == nil {
			zones = []EventZone{}
		}
		c.JSON(http.StatusOK, zones)
	})

	// ── POST /events ─────────────────────────────────────────────────────────
	router.POST("/events", func(c *gin.Context) {
		type ZoneReq struct {
			Name        string `json:"name"`
			Capacity    int    `json:"capacity"`
			Price       int    `json:"price"`
			Description string `json:"description"`
		}
		type CreateReq struct {
			Name        string    `json:"name"`
			Time        string    `json:"time"`
			Date        string    `json:"date"`
			Location    string    `json:"location"`
			Address     string    `json:"address"`
			ImageUrl    string    `json:"image_url"`
			MapUrl      string    `json:"map_url"`
			Description string    `json:"description"`
			Category    string    `json:"category"`
			Zones       []ZoneReq `json:"zones"`
		}
		var req CreateReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		totalSpaces := 0
		for _, z := range req.Zones {
			totalSpaces += z.Capacity
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
			return
		}
		defer tx.Rollback()

		var newID int
		err = tx.QueryRow(`INSERT INTO events (name, time, date, location, address, total_spaces, image_url, map_url, description, category)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
			req.Name, req.Time, req.Date, req.Location, req.Address,
			totalSpaces, req.ImageUrl, req.MapUrl, req.Description, req.Category,
		).Scan(&newID)
		if err != nil {
			log.Printf("Insert event error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create event"})
			return
		}

		for _, z := range req.Zones {
			var zoneID int
			err = tx.QueryRow(`INSERT INTO event_zones (event_id, name, capacity, price, description)
				VALUES ($1,$2,$3,$4,$5) RETURNING id`,
				newID, z.Name, z.Capacity, z.Price, z.Description,
			).Scan(&zoneID)
			if err != nil {
				log.Printf("Insert zone error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create zones"})
				return
			}
			_, err = tx.Exec(`INSERT INTO tickets (event_id, zone_id, seat_name, is_reserved)
				SELECT $1, $2, $3 || '-' || i, false FROM generate_series(1,$4) AS i`,
				newID, zoneID, z.Name, z.Capacity)
			if err != nil {
				log.Printf("Generate tickets error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tickets"})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction commit failed"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "Event created successfully", "event_id": newID})
	})

	// ── PUT /events/:id ───────────────────────────────────────────────────────
	router.PUT("/events/:id", func(c *gin.Context) {
		type UpdateReq struct {
			Name        string `json:"name"`
			Time        string `json:"time"`
			Date        string `json:"date"`
			Location    string `json:"location"`
			Address     string `json:"address"`
			ImageUrl    string `json:"image_url"`
			MapUrl      string `json:"map_url"`
			Description string `json:"description"`
			Category    string `json:"category"`
		}
		var req UpdateReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}
		result, err := db.Exec(`UPDATE events SET name=$1, time=$2, date=$3, location=$4, address=$5,
			image_url=$6, map_url=$7, description=$8, category=$9 WHERE id=$10`,
			req.Name, req.Time, req.Date, req.Location, req.Address,
			req.ImageUrl, req.MapUrl, req.Description, req.Category, c.Param("id"))
		if err != nil {
			log.Printf("Update event error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update event"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Event updated successfully"})
	})

	// ── DELETE /events/:id ────────────────────────────────────────────────────
	router.DELETE("/events/:id", func(c *gin.Context) {
		result, err := db.Exec("DELETE FROM events WHERE id=$1", c.Param("id"))
		if err != nil {
			log.Printf("Delete event error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete event"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Event deleted successfully"})
	})

	// ── GET /admin/stats ──────────────────────────────────────────────────────
	router.GET("/admin/stats", func(c *gin.Context) {
		type EventStat struct {
			ID           int    `json:"id"`
			Name         string `json:"name"`
			Category     string `json:"category"`
			TotalTickets int    `json:"total_tickets"`
			SoldTickets  int    `json:"sold_tickets"`
			Reserved     int    `json:"reserved_tickets"`
			Revenue      int64  `json:"revenue"`
		}

		rows, err := db.Query(`
			SELECT e.id, e.name, COALESCE(e.category,'Khác'),
				COUNT(t.id) AS total,
				COUNT(t.id) FILTER (WHERE t.is_confirmed = true) AS sold,
				COUNT(t.id) FILTER (WHERE t.is_reserved = true AND t.is_confirmed = false) AS reserved,
				COALESCE(SUM(ez.price) FILTER (WHERE t.is_confirmed = true), 0) AS revenue
			FROM events e
			LEFT JOIN tickets t ON t.event_id = e.id
			LEFT JOIN event_zones ez ON t.zone_id = ez.id
			GROUP BY e.id, e.name, e.category
			ORDER BY revenue DESC`)
		if err != nil {
			log.Printf("Stats query error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
			return
		}
		defer rows.Close()

		var eventStats []EventStat
		var totalTickets, totalSold int
		var totalRevenue int64

		for rows.Next() {
			var s EventStat
			if err := rows.Scan(&s.ID, &s.Name, &s.Category, &s.TotalTickets, &s.SoldTickets, &s.Reserved, &s.Revenue); err != nil {
				continue
			}
			totalTickets += s.TotalTickets
			totalSold += s.SoldTickets
			totalRevenue += s.Revenue
			eventStats = append(eventStats, s)
		}
		if eventStats == nil {
			eventStats = []EventStat{}
		}

		// Category breakdown
		type CatStat struct {
			Category string `json:"category"`
			Total    int    `json:"total"`
			Sold     int    `json:"sold"`
		}
		catRows, err := db.Query(`
			SELECT COALESCE(e.category,'Khác'),
				COUNT(t.id) AS total,
				COUNT(t.id) FILTER (WHERE t.is_confirmed = true) AS sold
			FROM events e
			LEFT JOIN tickets t ON t.event_id = e.id
			GROUP BY e.category
			ORDER BY sold DESC`)
		var categories []CatStat
		if err == nil {
			defer catRows.Close()
			for catRows.Next() {
				var cs CatStat
				catRows.Scan(&cs.Category, &cs.Total, &cs.Sold)
				categories = append(categories, cs)
			}
		}
		if categories == nil {
			categories = []CatStat{}
		}

		c.JSON(http.StatusOK, gin.H{
			"total_events":  len(eventStats),
			"total_tickets": totalTickets,
			"total_sold":    totalSold,
			"total_revenue": totalRevenue,
			"events":        eventStats,
			"categories":    categories,
		})
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
