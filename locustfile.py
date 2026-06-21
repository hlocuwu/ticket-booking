"""
Stress test: full booking flow — browse event → chọn ghế → book → confirm payment.

Mỗi Locust user được gán 1 trong 30 test accounts (locust_1 .. locust_30) và
1 trong 30 events để tránh tranh chấp queue.

Run:
    # Web UI
    locust -f locustfile.py --host https://flashticket.site

    # Headless
    locust -f locustfile.py --host https://flashticket.site \
        --headless -u 30 -r 3 --run-time 10m
"""

import json
import os
import time
import random
import threading
import requests
from locust import HttpUser, task, between, events

# ── Config ─────────────────────────────────────────────────────────────────────
NUM_USERS      = 1000
TOKEN_FILE     = os.path.join(os.path.dirname(__file__), "tokens.json")
EVENT_IDS      = list(range(1, 11))
HOT_EVENT_ID   = 10  # VCT Pacific Stage 1 Finals (Valorant)
RETURN_URL     = "https://flashticket.site/payment-callback"
QUEUE_POLL_INT    = 1.0   # seconds between queue status polls
QUEUE_TIMEOUT     = 60    # seconds to wait before giving up
QUEUE_MAX_SLOTS   = 50    # must match QUEUE_MAX_CONCURRENT on server

# ── Load pre-generated tokens from file ────────────────────────────────────────
_tokens: dict = {}


@events.init.add_listener
def on_init(environment, **kwargs):
    if not os.path.exists(TOKEN_FILE):
        print(f"\n[ERROR] {TOKEN_FILE} not found. Run: python3 generate_tokens.py\n")
        return
    with open(TOKEN_FILE) as f:
        _tokens.update(json.load(f))
    ok = sum(1 for t in _tokens.values() if t)
    print(f"\n[init] Loaded {ok}/{len(_tokens)} tokens — no login calls during test\n")


# ── User counter (thread-safe) ──────────────────────────────────────────────────
_user_counter = 0
_counter_lock = threading.Lock()


def next_user_index() -> int:
    global _user_counter
    with _counter_lock:
        idx = _user_counter % NUM_USERS
        _user_counter += 1
    return idx


# ── Main user class ─────────────────────────────────────────────────────────────
class BookingUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        idx            = next_user_index()
        self.username  = f"locust_{idx + 1}"
        self.email     = f"locust_{idx + 1}@test.com"
        self.event_id  = HOT_EVENT_ID
        self.token     = _tokens.get(self.username, "")
        self.auth_hdr  = {"Authorization": f"Bearer {self.token}"}

    # ── Tasks ──────────────────────────────────────────────────────────────────

    @task(1)
    def full_booking_flow(self):
        """
        1. Xem danh sách events
        2. Xem chi tiết event + zones
        3. Lấy vé available
        4. Vào hàng đợi (join queue)
        5. Poll cho đến khi position = 1
        6. Book vé (reserve + tạo payment)
        7. Confirm payment (giả lập bấm nút "Thanh Toán")
        8. Rời hàng đợi
        """
        # 1. Browse
        self.client.get("/api/events/events", name="/api/events/events")
        self.client.get(
            f"/api/events/events/{self.event_id}",
            name="/api/events/events/[id]",
        )

        # 2. Zones (chỉ để biết zone_id và giá — không query inventory ở đây)
        zones_resp = self.client.get(
            f"/api/events/events/{self.event_id}/zones",
            name="/api/events/events/[id]/zones",
        )
        zones = zones_resp.json() if zones_resp.status_code == 200 else []
        if not zones:
            return
        zone = zones[0]
        zone_id    = zone["id"]
        zone_price = int(zone.get("price") or 100000)

        # 3. Join waiting room TRƯỚC khi chọn ghế
        join_resp = self.client.post(
            "/api/queue/queue/join",
            json={"user_id": self.username, "event_id": str(self.event_id)},
            name="/api/queue/queue/join",
        )
        if join_resp.status_code not in (200, 201):
            return

        # 4. Poll queue đến khi đến lượt
        deadline = time.time() + QUEUE_TIMEOUT
        position = 999
        while time.time() < deadline:
            status_resp = self.client.get(
                f"/api/queue/queue/status?user_id={self.username}&event_id={self.event_id}",
                name="/api/queue/queue/status",
            )
            if status_resp.status_code == 200:
                position = status_resp.json().get("position", 999)
                if position <= QUEUE_MAX_SLOTS:
                    break
            time.sleep(QUEUE_POLL_INT)

        if position > QUEUE_MAX_SLOTS:
            # Timed out — leave queue and skip
            self.client.post(
                "/api/queue/queue/leave",
                json={"user_id": self.username},
                name="/api/queue/queue/leave",
            )
            return

        # 5b. Đến lượt rồi — giờ mới get danh sách ghế available
        inv_resp = self.client.get(
            f"/api/inventory/tickets?event_id={self.event_id}&zone_id={zone_id}",
            name="/api/inventory/tickets",
        )
        if inv_resp.status_code != 200:
            self._leave_queue()
            return
        available = [t for t in inv_resp.json() if not t.get("is_reserved")]
        if not available:
            self._leave_queue()
            return
        ticket_id = random.choice(available)["id"]

        # 6. Book
        book_resp = self.client.post(
            "/api/booking/book",
            json={
                "user_id":        self.username,
                "event_id":       str(self.event_id),
                "ticket_ids":     [ticket_id],
                "amount":         zone_price,
                "return_url":     RETURN_URL,
                "payment_method": "mock",
            },
            headers=self.auth_hdr,
            name="/api/booking/book",
        )
        if book_resp.status_code != 200:
            if book_resp.status_code == 400:
                print(f"[400] user={self.username} event={self.event_id} ticket={ticket_id} amount={zone_price} body={book_resp.text}")
            self._leave_queue()
            return
        order_id = book_resp.json().get("order_id", "")
        if not order_id:
            self._leave_queue()
            return

        # 7. Giả lập bấm nút "Thanh Toán" → confirm trực tiếp
        self.client.post(
            "/api/booking/confirm",
            json={
                "order_id":   order_id,
                "user_id":    self.username,
                "user_email": self.email,
                "ticket_ids": [ticket_id],
                "event_name": f"Event {self.event_id}",
                "amount":     zone_price,
            },
            name="/api/booking/confirm",
        )

        # 8. Leave queue
        self._leave_queue()

        # Giữ nguyên hot event cho các iteration tiếp theo
        self.event_id = HOT_EVENT_ID

    def _leave_queue(self):
        self.client.post(
            "/api/queue/queue/leave",
            json={"user_id": self.username, "event_id": str(self.event_id)},
            name="/api/queue/queue/leave",
        )
