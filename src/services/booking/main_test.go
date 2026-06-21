package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func init() {
	gin.SetMode(gin.TestMode)
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

// mockServer creates a fake HTTP server that always returns the given status and body.
func mockServer(status int, body string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
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

func TestHealth(t *testing.T) {
	rdb, _ := newTestRedis(t)
	r := setupRouter(rdb, Services{}, 50)

	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["service"] != "booking" {
		t.Errorf("service = %q, want booking", body["service"])
	}
}

// --- POST /rollback ---

func TestRollback_MissingFields(t *testing.T) {
	rdb, _ := newTestRedis(t)
	r := setupRouter(rdb, Services{}, 50)

	w := do(r, http.MethodPost, "/rollback", `{"order_id":"ORD-1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRollback_Success(t *testing.T) {
	rdb, _ := newTestRedis(t)
	inv := mockServer(http.StatusOK, `{"message":"ok"}`)
	defer inv.Close()

	r := setupRouter(rdb, Services{InventoryURL: inv.URL}, 50)
	w := do(r, http.MethodPost, "/rollback", `{"order_id":"ORD-1","user_id":"u1","ticket_ids":[1,2]}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRollback_InventoryDown(t *testing.T) {
	rdb, _ := newTestRedis(t)
	r := setupRouter(rdb, Services{InventoryURL: "http://127.0.0.1:1"}, 50) // unreachable

	w := do(r, http.MethodPost, "/rollback", `{"order_id":"ORD-1","user_id":"u1","ticket_ids":[1]}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- POST /confirm ---

func TestConfirm_MissingFields(t *testing.T) {
	rdb, _ := newTestRedis(t)
	r := setupRouter(rdb, Services{}, 50)

	w := do(r, http.MethodPost, "/confirm", `{"order_id":"ORD-1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestConfirm_Success(t *testing.T) {
	rdb, _ := newTestRedis(t)
	inv := mockServer(http.StatusOK, `{"message":"ok"}`)
	notif := mockServer(http.StatusOK, `{"message":"sent"}`)
	defer inv.Close()
	defer notif.Close()

	svc := Services{InventoryURL: inv.URL, NotificationURL: notif.URL}
	r := setupRouter(rdb, svc, 50)

	payload := `{"order_id":"ORD-1","user_id":"u1","user_email":"u@test.com","ticket_ids":[1,2],"event_name":"Festival","amount":200000}`
	w := do(r, http.MethodPost, "/confirm", payload)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// --- POST /book ---

func TestBook_MissingAuthHeader(t *testing.T) {
	rdb, _ := newTestRedis(t)
	r := setupRouter(rdb, Services{}, 50)

	payload := `{"user_id":"u1","event_id":"e1","ticket_ids":[1],"amount":100,"return_url":"http://localhost"}`
	w := do(r, http.MethodPost, "/book", payload)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestBook_MissingFields(t *testing.T) {
	rdb, _ := newTestRedis(t)
	r := setupRouter(rdb, Services{}, 50)

	w := do(r, http.MethodPost, "/book", `{}`, "Authorization", "Bearer sometoken")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestBook_AuthServiceDown(t *testing.T) {
	rdb, _ := newTestRedis(t)
	svc := Services{AuthURL: "http://127.0.0.1:1"} // unreachable
	r := setupRouter(rdb, svc, 50)

	payload := `{"user_id":"u1","event_id":"e1","ticket_ids":[1],"amount":100,"return_url":"http://localhost"}`
	w := do(r, http.MethodPost, "/book", payload, "Authorization", "Bearer token")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestBook_AuthInvalidToken(t *testing.T) {
	rdb, _ := newTestRedis(t)
	auth := mockServer(http.StatusUnauthorized, `{"error":"invalid token"}`)
	defer auth.Close()

	r := setupRouter(rdb, Services{AuthURL: auth.URL}, 50)
	payload := `{"user_id":"u1","event_id":"e1","ticket_ids":[1],"amount":100,"return_url":"http://localhost"}`
	w := do(r, http.MethodPost, "/book", payload, "Authorization", "Bearer badtoken")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

// --- Redis state: markOrderConfirmed / isOrderConfirmed ---

func TestOrderConfirmedState(t *testing.T) {
	rdb, _ := newTestRedis(t)

	if isOrderConfirmed(rdb, "ORD-TEST") {
		t.Error("order should NOT be confirmed initially")
	}
	markOrderConfirmed(rdb, "ORD-TEST")
	if !isOrderConfirmed(rdb, "ORD-TEST") {
		t.Error("order SHOULD be confirmed after markOrderConfirmed")
	}
}
