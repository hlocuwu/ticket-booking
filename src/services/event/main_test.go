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
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db, mock
}

func do(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func makeAdminToken(t *testing.T, secret []byte) string {
	t.Helper()
	claims := &Claims{
		Username: "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("make token: %v", err)
	}
	return token
}

func makeUserToken(t *testing.T, secret []byte) string {
	t.Helper()
	claims := &Claims{
		Username: "regular_user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("make token: %v", err)
	}
	return token
}

// --- /health ---

func TestHealth(t *testing.T) {
	db, _ := newMockDB(t)
	r := setupRouter(db)

	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["service"] != "event" {
		t.Errorf("service = %q, want event", body["service"])
	}
}

// --- GET /events ---

func TestGetEvents_Empty(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "time", "date", "location", "address", "total_spaces", "image_url", "map_url", "description", "category", "min_price"}))

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/events", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var events []Event
	json.Unmarshal(w.Body.Bytes(), &events)
	if len(events) != 0 {
		t.Errorf("expected empty list, got %d events", len(events))
	}
}

func TestGetEvents_WithSearch(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT").
		WithArgs("%rock%").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "time", "date", "location", "address", "total_spaces", "image_url", "map_url", "description", "category", "min_price"}).
			AddRow(1, "Rock Festival", "19:00", "2026-06-01", "HCM", "", 500, "", "", "", "Âm nhạc", 200000))

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/events?search=rock", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetEvents_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT").WillReturnError(sql.ErrConnDone)

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/events", "")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- GET /events/:id ---

func TestGetEventByID_Found(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT id, name").
		WithArgs("1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "time", "date", "location", "address", "total_spaces", "image_url", "map_url", "description", "category"}).
			AddRow(1, "Festival", "18:00", "2026-07-01", "Hanoi", "", 300, "", "", "", "Âm nhạc"))

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/events/1", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var ev Event
	json.Unmarshal(w.Body.Bytes(), &ev)
	if ev.Name != "Festival" {
		t.Errorf("name = %q, want Festival", ev.Name)
	}
}

func TestGetEventByID_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT id, name").
		WithArgs("999").
		WillReturnError(sql.ErrNoRows)

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/events/999", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- GET /events/:id/zones ---

func TestGetEventZones_Empty(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT id, event_id").
		WithArgs("1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "event_id", "name", "capacity", "price", "description"}))

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/events/1/zones", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// --- Admin middleware ---

func TestAdminMiddleware_NoToken(t *testing.T) {
	db, _ := newMockDB(t)
	jwtKey = []byte("test-secret")
	r := setupRouter(db)

	w := do(r, http.MethodPost, "/events", `{"name":"x"}`)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAdminMiddleware_InvalidToken(t *testing.T) {
	db, _ := newMockDB(t)
	jwtKey = []byte("test-secret")
	r := setupRouter(db)

	req := httptest.NewRequest(http.MethodPost, "/events", strings.NewReader(`{"name":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer not.a.real.token")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAdminMiddleware_NonAdminUser(t *testing.T) {
	db, _ := newMockDB(t)
	secret := []byte("test-secret")
	jwtKey = secret
	r := setupRouter(db)

	token := makeUserToken(t, secret)
	req := httptest.NewRequest(http.MethodPost, "/events", strings.NewReader(`{"name":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestAdminDeleteEvent_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	secret := []byte("test-secret")
	jwtKey = secret
	mock.ExpectExec("DELETE FROM events").
		WithArgs("99").
		WillReturnResult(sqlmock.NewResult(0, 0))

	r := setupRouter(db)
	token := makeAdminToken(t, secret)
	req := httptest.NewRequest(http.MethodDelete, "/events/99", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
