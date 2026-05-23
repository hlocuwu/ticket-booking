package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.MonitorPingsOption(true))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db, mock
}

func newTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { mr.Close() })
	return rdb, mr
}

func makeToken(t *testing.T, username string, secret []byte, ttl time.Duration) string {
	t.Helper()
	claims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
		},
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("makeToken: %v", err)
	}
	return tok
}

func do(r http.Handler, method, path, body string, headers ...string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// --- /health ---

func TestHealth_Up(t *testing.T) {
	db, mock := newMockDB(t)
	rdb, _ := newTestRedis(t)
	mock.ExpectPing()

	r := setupRouter(db, rdb, "")
	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["service"] != "auth" {
		t.Errorf("service = %q, want auth", body["service"])
	}
}

func TestHealth_Down(t *testing.T) {
	db, mock := newMockDB(t)
	rdb, _ := newTestRedis(t)
	mock.ExpectPing().WillReturnError(sql.ErrConnDone)

	r := setupRouter(db, rdb, "")
	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- POST /verify ---

func TestVerify_NoAuthHeader(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	jwtKey = []byte("secret")
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/verify", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestVerify_BadFormat(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	jwtKey = []byte("secret")
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/verify", "", "Authorization", "Token abc123")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestVerify_InvalidToken(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	jwtKey = []byte("secret")
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/verify", "", "Authorization", "Bearer not.a.valid.token")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestVerify_ExpiredToken(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	secret := []byte("secret")
	jwtKey = secret
	r := setupRouter(db, rdb, "")

	token := makeToken(t, "user1", secret, -time.Minute) // already expired
	w := do(r, http.MethodPost, "/verify", "", "Authorization", "Bearer "+token)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestVerify_ValidToken(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	secret := []byte("secret")
	jwtKey = secret
	r := setupRouter(db, rdb, "")

	token := makeToken(t, "alice", secret, time.Hour)
	w := do(r, http.MethodPost, "/verify", "", "Authorization", "Bearer "+token)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["username"] != "alice" {
		t.Errorf("username = %v, want alice", body["username"])
	}
	if body["valid"] != true {
		t.Errorf("valid should be true")
	}
}

// --- POST /login ---

func TestLogin_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/login", `{"username":"user1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	db, mock := newMockDB(t)
	rdb, _ := newTestRedis(t)
	mock.ExpectQuery("SELECT username, password_hash").
		WithArgs("nobody").
		WillReturnError(sql.ErrNoRows)
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/login", `{"username":"nobody","password":"pass"}`)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

// --- POST /register/send-otp ---

func TestSendOTP_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/register/send-otp", `{"username":"u1","password":"p1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 (missing email), got %d", w.Code)
	}
}

func TestSendOTP_UserAlreadyExists(t *testing.T) {
	db, mock := newMockDB(t)
	rdb, _ := newTestRedis(t)
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs("u1", "u1@test.com").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/register/send-otp", `{"username":"u1","email":"u1@test.com","password":"pass123"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

// --- POST /register/verify ---

func TestVerifyOTP_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodPost, "/register/verify", `{"email":"u@test.com"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestVerifyOTP_Expired(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	r := setupRouter(db, rdb, "")

	// No OTP stored in Redis → should return 400
	w := do(r, http.MethodPost, "/register/verify", `{"email":"u@test.com","otp":"123456"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- GET /profile ---

func TestProfile_NoToken(t *testing.T) {
	db, _ := newMockDB(t)
	rdb, _ := newTestRedis(t)
	r := setupRouter(db, rdb, "")

	w := do(r, http.MethodGet, "/profile", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
