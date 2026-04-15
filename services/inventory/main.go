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

type Ticket struct {
        ID         int    `json:"id"`
        EventID    int    `json:"event_id"`
        SeatName   string `json:"seat_name"`
        IsReserved bool   `json:"is_reserved"`
}

type MyTicketInfo struct {
        ID        int    `json:"id"`
        EventID   int    `json:"event_id"`
        EventName string `json:"event_name"`
        Date      string `json:"date"`
        Location  string `json:"location"`
        SeatName  string `json:"seat_name"`
        ImageURL  string `json:"image_url"`
}

type ReserveRequest struct {
        TicketID int    `json:"ticket_id" binding:"required"`
        OwnerID  string `json:"owner_id" binding:"required"`
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

        router.GET("/health", func(c *gin.Context) {
                if err := db.Ping(); err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
                        return
                }
                c.JSON(http.StatusOK, gin.H{"status": "up", "service": "inventory"})
        })

        router.GET("/tickets", func(c *gin.Context) {
                rows, err := db.Query("SELECT id, event_id, seat_name, is_reserved FROM tickets")
                if err != nil {
                        log.Printf("Database error: %v", err)
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tickets"})
                        return
                }
                defer rows.Close()

                var tickets []Ticket
                for rows.Next() {
                        var t Ticket
                        if err := rows.Scan(&t.ID, &t.EventID, &t.SeatName, &t.IsReserved); err != nil {
                                continue
                        }
                        tickets = append(tickets, t)
                }
                c.JSON(http.StatusOK, tickets)
        })

        router.GET("/user/tickets/:user_id", func(c *gin.Context) {
                userID := c.Param("user_id")
                rows, err := db.Query(`
                        SELECT t.id, t.event_id, e.name, TO_CHAR(e.date, 'YYYY-MM-DD'), e.location, t.seat_name, e.image_url
                        FROM tickets t
                        JOIN events e ON t.event_id = e.id
                        WHERE t.owner_id = $1
                        ORDER BY e.date DESC, t.id ASC
                `, userID)
                if err != nil {
                        log.Printf("Database error fetching user tickets: %v", err)
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user tickets"})
                        return
                }
                defer rows.Close()

                var tickets []MyTicketInfo
                for rows.Next() {
                        var t MyTicketInfo
                        // Using TO_CHAR ensures standard string format without time. We can parse it directly safely.
                        if err := rows.Scan(&t.ID, &t.EventID, &t.EventName, &t.Date, &t.Location, &t.SeatName, &t.ImageURL); err != nil {
                                continue
                        }
                        tickets = append(tickets, t)
                }
                c.JSON(http.StatusOK, tickets)
        })

        router.POST("/tickets/reserve", func(c *gin.Context) {
                var req ReserveRequest
                if err := c.ShouldBindJSON(&req); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload. 'ticket_id' and 'owner_id' are required."})
                        return
                }

                result, err := db.Exec("UPDATE tickets SET is_reserved = true, owner_id = $2 WHERE id = $1 AND is_reserved = false", req.TicketID, req.OwnerID)
                if err != nil {
                        log.Printf("Database error during reservation: %v", err)
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
                        return
                }

                rowsAffected, err := result.RowsAffected()
                if err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify reservation status"})
                        return
                }
                if rowsAffected == 0 {
                        c.JSON(http.StatusConflict, gin.H{"error": "Ticket is already reserved or does not exist"})
                        return
                }

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
