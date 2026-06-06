package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
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

// --- /health ---

func TestHealth_Up(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectPing()
	r := setupRouter(db)

	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["service"] != "inventory" {
		t.Errorf("service = %q, want inventory", body["service"])
	}
}

func TestHealth_Down(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectPing().WillReturnError(sql.ErrConnDone)
	r := setupRouter(db)

	w := do(r, http.MethodGet, "/health", "")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- GET /tickets ---

func TestGetTickets_All(t *testing.T) {
	db, mock := newMockDB(t)
	cols := []string{"id", "event_id", "zone_id", "seat_name", "is_reserved"}
	mock.ExpectQuery("SELECT id, event_id, zone_id").
		WillReturnRows(sqlmock.NewRows(cols).
			AddRow(1, 10, 20, "A-1", false).
			AddRow(2, 10, 20, "A-2", true))

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/tickets", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var tickets []Ticket
	json.Unmarshal(w.Body.Bytes(), &tickets)
	if len(tickets) != 2 {
		t.Errorf("expected 2 tickets, got %d", len(tickets))
	}
}

func TestGetTickets_ByEvent(t *testing.T) {
	db, mock := newMockDB(t)
	cols := []string{"id", "event_id", "zone_id", "seat_name", "is_reserved"}
	mock.ExpectQuery("SELECT id, event_id, zone_id").
		WithArgs("10").
		WillReturnRows(sqlmock.NewRows(cols).AddRow(1, 10, 20, "A-1", false))

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/tickets?event_id=10", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetTickets_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectQuery("SELECT id, event_id, zone_id").WillReturnError(sql.ErrConnDone)

	r := setupRouter(db)
	w := do(r, http.MethodGet, "/tickets", "")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- POST /tickets/reserve ---

func TestReserve_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	r := setupRouter(db)

	w := do(r, http.MethodPost, "/tickets/reserve", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestReserve_Success(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectExec("UPDATE tickets SET is_reserved").
		WithArgs(1, "user1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	r := setupRouter(db)
	w := do(r, http.MethodPost, "/tickets/reserve", `{"ticket_id":1,"owner_id":"user1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReserve_AlreadyReserved(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectExec("UPDATE tickets SET is_reserved").
		WithArgs(1, "user1").
		WillReturnResult(sqlmock.NewResult(0, 0)) // 0 rows affected → conflict

	r := setupRouter(db)
	w := do(r, http.MethodPost, "/tickets/reserve", `{"ticket_id":1,"owner_id":"user1"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

// --- POST /tickets/reserve-batch ---

func TestReserveBatch_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	r := setupRouter(db)

	w := do(r, http.MethodPost, "/tickets/reserve-batch", `{"owner_id":"user1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestReserveBatch_Success(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE tickets SET is_reserved").WithArgs(1, "user1").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("UPDATE tickets SET is_reserved").WithArgs(2, "user1").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	r := setupRouter(db)
	w := do(r, http.MethodPost, "/tickets/reserve-batch", `{"ticket_ids":[1,2],"owner_id":"user1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReserveBatch_Conflict(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE tickets SET is_reserved").WithArgs(1, "user1").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	r := setupRouter(db)
	w := do(r, http.MethodPost, "/tickets/reserve-batch", `{"ticket_ids":[1],"owner_id":"user1"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

// --- POST /tickets/rollback-batch ---

func TestRollbackBatch_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	r := setupRouter(db)

	w := do(r, http.MethodPost, "/tickets/rollback-batch", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRollbackBatch_Success(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE tickets SET is_reserved = false").WithArgs(1, "user1").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	r := setupRouter(db)
	w := do(r, http.MethodPost, "/tickets/rollback-batch", `{"ticket_ids":[1],"owner_id":"user1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// --- POST /tickets/confirm-batch ---

func TestConfirmBatch_MissingFields(t *testing.T) {
	db, _ := newMockDB(t)
	r := setupRouter(db)

	w := do(r, http.MethodPost, "/tickets/confirm-batch", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestConfirmBatch_Success(t *testing.T) {
	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE tickets SET is_confirmed").WithArgs(1, "user1").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	r := setupRouter(db)
	w := do(r, http.MethodPost, "/tickets/confirm-batch", `{"ticket_ids":[1],"owner_id":"user1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
