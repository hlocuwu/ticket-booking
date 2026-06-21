package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

var bgCtx = context.Background()

var jwtKey []byte

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return v
}

type AuthRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required"`
}

type VerifyRequest struct {
	Email string `json:"email" binding:"required"`
	OTP   string `json:"otp" binding:"required"`
}

type OtpData struct {
	Username       string `json:"username"`
	Email          string `json:"email"`
	HashedPassword string `json:"hashed_password"`
	OTP            string `json:"otp"`
}

func generateOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		log.Fatalf("crypto/rand error: %v", err)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

func sendEmailNotification(notificationURL, toEmail, subject, body string) error {
	url := notificationURL + "/send-email"
	payload := map[string]string{
		"to_email": toEmail,
		"subject":  subject,
		"body":     body,
	}
	jsonPayload, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("notification service returned status %d", resp.StatusCode)
	}
	return nil
}

type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func setupRouter(db *sql.DB, rdb *redis.Client, notificationURL string) *gin.Engine {
	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "auth"})
	})

	router.POST("/register/send-otp", func(c *gin.Context) {
		var req AuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		if req.Email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
			return
		}

		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 OR email = $2)", req.Username, req.Email).Scan(&exists)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "Tên đăng nhập hoặc email đã tồn tại"})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		otp := generateOTP()

		otpData := OtpData{
			Username:       req.Username,
			Email:          req.Email,
			HashedPassword: string(hashedPassword),
			OTP:            otp,
		}
		jsonData, _ := json.Marshal(otpData)
		redisKey := "otp:" + req.Email

		err = rdb.Set(bgCtx, redisKey, jsonData, 5*time.Minute).Err()
		if err != nil {
			log.Printf("Redis Set Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store OTP"})
			return
		}

		subject := "Mã xác thực OTP Đăng ký - FlashTicket"
		body := fmt.Sprintf(`<div>OTP: %s</div>`, otp)

		if err := sendEmailNotification(notificationURL, req.Email, subject, body); err != nil {
			log.Printf("Email Notification Error: %v", err)
		}

		c.JSON(http.StatusOK, gin.H{"message": "OTP sent successfully"})
	})

	router.POST("/register/verify", func(c *gin.Context) {
		var req VerifyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		redisKey := "otp:" + req.Email
		val, err := rdb.Get(bgCtx, redisKey).Result()
		if err == redis.Nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mã OTP đã hết hạn hoặc không tồn tại"})
			return
		} else if err != nil {
			log.Printf("Redis Get Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}

		var otpData OtpData
		if err := json.Unmarshal([]byte(val), &otpData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse OTP data"})
			return
		}

		if otpData.OTP != req.OTP {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mã OTP không chính xác"})
			return
		}

		_, err = db.Exec("INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)", otpData.Username, otpData.Email, otpData.HashedPassword)
		if err != nil {
			if strings.Contains(err.Error(), "unique constraint") {
				c.JSON(http.StatusConflict, gin.H{"error": "Username or Email already exists"})
				return
			}
			log.Printf("DB Insert Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		rdb.Del(bgCtx, redisKey)

		c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully"})
	})

	router.POST("/login", func(c *gin.Context) {
		var req AuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

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

		err = bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

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

		var email, fullName, phone, gender, avatar sql.NullString
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

		var storedHash string
		err = db.QueryRow("SELECT password_hash FROM users WHERE username = $1", claims.Username).Scan(&storedHash)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		err = bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.CurrentPassword))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu hiện tại không đúng"})
			return
		}

		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi hệ thống khi tạo mật khẩu"})
			return
		}

		_, err = db.Exec("UPDATE users SET password_hash = $1 WHERE username = $2", string(newHash), claims.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cập nhật mật khẩu thất bại"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Đổi mật khẩu thành công"})
	})

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

	return router
}

func main() {
	fmt.Println("Starting Auth Service...")

	jwtKey = []byte(mustGetEnv("JWT_SECRET"))

	notificationURL := os.Getenv("NOTIFICATION_URL")
	if notificationURL == "" {
		notificationURL = "http://ticket_notification_service:8086"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbUser := mustGetEnv("DB_USER")
	dbPassword := mustGetEnv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "ticket_db"
	}

	connStr := fmt.Sprintf("host=%s port=5432 user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbUser, dbPassword, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	if err = db.Ping(); err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}
	fmt.Println("✅ Auth Service connected to PostgreSQL!")

	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "ticket_redis:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})
	if err := rdb.Ping(bgCtx).Err(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	fmt.Println("✅ Auth Service connected to Redis!")

	router := setupRouter(db, rdb, notificationURL)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Auth Service listening on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
