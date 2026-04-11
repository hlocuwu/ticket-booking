package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var jwtKey = []byte("flashticket_super_secret_key_2026")

type AuthRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required"`
}

type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func main() {
	fmt.Println("Starting Auth Service...")

	// 1. Connect to PostgreSQL
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
		log.Fatalf("Error opening database: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}
	fmt.Println("✅ Auth Service connected to PostgreSQL!")

	router := gin.Default()

	// Healthcheck
	router.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "auth"})
	})

	// 2. ENDPOINT: Register a new account
	router.POST("/register", func(c *gin.Context) {
		var req AuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// Hash the password using bcrypt
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Insert the new user into the database
		_, err = db.Exec("INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)", req.Username, req.Email, string(hashedPassword))
		if err != nil {
			// A simple check to see if it's a unique constraint violation (username already exists)
			if strings.Contains(err.Error(), "unique constraint") {
				c.JSON(http.StatusConflict, gin.H{"error": "Username or Email already exists"})
				return
			}
			log.Printf("DB Insert Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully"})
	})

	// 3. ENDPOINT: Login
	router.POST("/login", func(c *gin.Context) {
		var req AuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// Fetch the user's hashed password from the database
		var storedHash string
		var actualUser string
		err := db.QueryRow("SELECT username, password_hash FROM users WHERE username = $1 OR email = $1", req.Username).Scan(&actualUser, &storedHash)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Compare the provided password with the stored hash
		err = bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Password is correct! Generate the JWT.
		expirationTime := time.Now().Add(1 * time.Hour)
		claims := &Claims{
			Username: actualUser,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(expirationTime),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtKey)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": tokenString})
	})

	// 3.5 ENDPOINT: GET /profile
	router.GET("/profile", func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is missing"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		tokenString := parts[1]
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Fetch user details from DB
		var email, fullName, phone, gender, avatar sql.NullString
		// To format date properly to string, using NullTime or scan into string. We'll use NullString for date.
		var dob sql.NullString

		err = db.QueryRow("SELECT email, full_name, phone, CAST(dob AS VARCHAR), gender, avatar FROM users WHERE username = $1", claims.Username).Scan(
			&email, &fullName, &phone, &dob, &gender, &avatar,
		)

		if err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"username": claims.Username,
			"email":    email.String,
			"fullName": fullName.String,
			"phone":    phone.String,
			"dob":      dob.String,
			"gender":   gender.String,
			"avatar":   avatar.String,
		})
	})

	// 3.6 ENDPOINT: PUT /profile (Cập nhật Profile)
	router.PUT("/profile", func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) { return jwtKey, nil })
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid/expired token"})
			return
		}

		// Nhận JSON payload mới từ người dùng
		var req struct {
			FullName string `json:"fullName"`
			Phone    string `json:"phone"`
			Dob      string `json:"dob"`
			Gender   string `json:"gender"`
			Avatar   string `json:"avatar"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		// Update vào Database (dob = null thay vì rỗng nếu rỗng gõ vào error timestamp cast)
		var dobPtr interface{}
		if req.Dob != "" {
			dobPtr = req.Dob
		} else {
			dobPtr = nil
		}

		_, err = db.Exec(
			"UPDATE users SET full_name=$1, phone=$2, dob=$3, gender=$4, avatar=$5 WHERE username=$6",
			req.FullName, req.Phone, dobPtr, req.Gender, req.Avatar, claims.Username,
		)

		if err != nil {
			log.Printf("PUT Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
	})

	// 3.7 ENDPOINT: PUT /password (Đổi mật khẩu)
	router.PUT("/password", func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) { return jwtKey, nil })
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid/expired token"})
			return
		}

		var req struct {
			CurrentPassword string `json:"currentPassword" binding:"required"`
			NewPassword     string `json:"newPassword" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: Thiếu tham số hoặc sai định dạng"})
			return
		}

		// Fetch current password hash
		var storedHash string
		err = db.QueryRow("SELECT password_hash FROM users WHERE username = $1", claims.Username).Scan(&storedHash)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Validate current password
		err = bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.CurrentPassword))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu hiện tại không đúng"})
			return
		}

		// Hash new password
		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi hệ thống khi tạo mật khẩu"})
			return
		}

		// Update database
		_, err = db.Exec("UPDATE users SET password_hash = $1 WHERE username = $2", string(newHash), claims.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cập nhật mật khẩu thất bại"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Đổi mật khẩu thành công"})
	})

	// 4. ENDPOINT: Verify a JWT
	router.POST("/verify", func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is missing"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}
		tokenString := parts[1]

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"valid":    true,
			"username": claims.Username,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Auth Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
