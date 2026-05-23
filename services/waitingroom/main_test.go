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

func newTestClient(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { mr.Close() })
	return rdb, mr
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

// --- queueKey ---

func TestQueueKey(t *testing.T) {
	got := queueKey("evt-42")
	if got != "ticket_queue:evt-42" {
		t.Errorf("got %q, want %q", got, "ticket_queue:evt-42")
	}
}

// --- /health ---

func TestHealth_Up(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["status"] != "up" {
		t.Errorf("status = %q, want up", body["status"])
	}
	if body["service"] != "waitingroom" {
		t.Errorf("service = %q, want waitingroom", body["service"])
	}
}

func TestHealth_Down(t *testing.T) {
	rdb, mr := newTestClient(t)
	mr.Close() // kill Redis before request
	r := setupRouter(rdb)

	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- POST /queue/join ---

func TestJoin_MissingFields(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	w := do(r, http.MethodPost, "/queue/join", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestJoin_Success(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	w := do(r, http.MethodPost, "/queue/join", `{"user_id":"u1","event_id":"e1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestJoin_Idempotent(t *testing.T) {
	// ZAddNX: joining twice should not error, just be a no-op
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	body := `{"user_id":"u1","event_id":"e1"}`
	w1 := do(r, http.MethodPost, "/queue/join", body)
	w2 := do(r, http.MethodPost, "/queue/join", body)
	if w1.Code != http.StatusOK || w2.Code != http.StatusOK {
		t.Fatalf("expected both 200, got %d and %d", w1.Code, w2.Code)
	}
}

// --- POST /queue/leave ---

func TestLeave_MissingFields(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	w := do(r, http.MethodPost, "/queue/leave", `{"user_id":"u1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestLeave_Success(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	// Join first
	do(r, http.MethodPost, "/queue/join", `{"user_id":"u1","event_id":"e1"}`)

	w := do(r, http.MethodPost, "/queue/leave", `{"user_id":"u1","event_id":"e1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// --- GET /queue/status ---

func TestStatus_MissingParams(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	w := do(r, http.MethodGet, "/queue/status?user_id=u1", "")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestStatus_NotInQueue(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	w := do(r, http.MethodGet, "/queue/status?user_id=u1&event_id=e1", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestStatus_Position(t *testing.T) {
	rdb, _ := newTestClient(t)
	r := setupRouter(rdb)

	// u1 joins first, u2 second
	do(r, http.MethodPost, "/queue/join", `{"user_id":"u1","event_id":"e1"}`)
	do(r, http.MethodPost, "/queue/join", `{"user_id":"u2","event_id":"e1"}`)

	w := do(r, http.MethodGet, "/queue/status?user_id=u1&event_id=e1", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["position"].(float64) != 1 {
		t.Errorf("u1 should be at position 1, got %v", body["position"])
	}

	w2 := do(r, http.MethodGet, "/queue/status?user_id=u2&event_id=e1", "")
	json.Unmarshal(w2.Body.Bytes(), &body)
	if body["position"].(float64) != 2 {
		t.Errorf("u2 should be at position 2, got %v", body["position"])
	}
}
