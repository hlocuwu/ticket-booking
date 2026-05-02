package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
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

var ctx = context.Background()

var jwtKey = []byte("flashticket_super_secret_key_2026")

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
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("%06d", r.Intn(1000000))
}

func sendEmailNotification(toEmail, subject, body string) error {
	url := "http://ticket_notification_service:8086/send-email"
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

	// 1.5 Connect to Redis
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "ticket_redis:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	fmt.Println("✅ Auth Service connected to Redis!")

	router := gin.Default()

	// Healthcheck
	router.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "up", "service": "auth"})
	})

	// 2. ENDPOINT: Request OTP for registration
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

		// Check if username or email already exists in Postgres
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

		// Hash the password using bcrypt
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Generate OTP
		otp := generateOTP()

		// Store in Redis (TTL: 5 minutes)
		otpData := OtpData{
			Username:       req.Username,
			Email:          req.Email,
			HashedPassword: string(hashedPassword),
			OTP:            otp,
		}
		jsonData, _ := json.Marshal(otpData)
		redisKey := "otp:" + req.Email

		err = rdb.Set(ctx, redisKey, jsonData, 5*time.Minute).Err()
		if err != nil {
			log.Printf("Redis Set Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store OTP"})
			return
		}

		// Send Email
		subject := "Mã xác thực OTP Đăng ký - FlashTicket"
		body := fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
				<div style="background-color: #00b14f; color: white; padding: 20px; text-align: center;">
					<h2 style="margin: 0;">Xác thực tài khoản</h2>
				</div>
				<div style="padding: 20px; background-color: #ffffff; color: #333333;">
					<p>Chào bạn,</p>
					<p>Mã xác thực OTP của bạn là:</p>
					<div style="text-align: center; margin: 30px 0;">
						<span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #00b14f; background: #f0fdf4; padding: 15px 30px; border-radius: 8px; border: 2px dashed #00b14f;">%s</span>
					</div>
					<p>Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
					<p>Trân trọng,<br>Đội ngũ FlashTicket</p>
				</div>
			</div>
		`, otp)

		err = sendEmailNotification(req.Email, subject, body)
		if err != nil {
			log.Printf("Email Notification Error: %v", err)
			// Continue even if email fails in local environment (since it simulates)
		}

		c.JSON(http.StatusOK, gin.H{"message": "OTP sent successfully"})
	})

	// 2.5 ENDPOINT: Verify OTP and create user
	router.POST("/register/verify", func(c *gin.Context) {
		var req VerifyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		redisKey := "otp:" + req.Email
		val, err := rdb.Get(ctx, redisKey).Result()
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

		// Insert the new user into the database
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

		// Delete OTP from Redis
		rdb.Del(ctx, redisKey)

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
