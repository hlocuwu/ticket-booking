import sys
import os
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app  # noqa: E402


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# --- /health ---

def test_health_returns_200(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_payload(client):
    data = client.get("/health").get_json()
    assert data["status"] == "up"
    assert data["service"] == "notification"


# --- /send-email validation ---

def test_send_email_empty_body_is_400(client):
    resp = client.post("/send-email", json={})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_send_email_missing_to_email(client):
    resp = client.post("/send-email", json={"subject": "Hi", "body": "Body"})
    assert resp.status_code == 400


def test_send_email_missing_subject(client):
    resp = client.post("/send-email", json={"to_email": "a@b.com", "body": "Body"})
    assert resp.status_code == 400


def test_send_email_missing_body(client):
    resp = client.post("/send-email", json={"to_email": "a@b.com", "subject": "Hi"})
    assert resp.status_code == 400


def test_send_email_no_content_type_is_4xx(client):
    # Flask 3.x returns 415 (Unsupported Media Type) for non-JSON content-type;
    # older versions return 400. Both are correct rejections.
    resp = client.post("/send-email", data="not json")
    assert resp.status_code in (400, 415)


# --- /send-email success path ---

def test_send_email_success_queues_thread(client):
    with patch("threading.Thread") as mock_thread_cls:
        mock_instance = MagicMock()
        mock_thread_cls.return_value = mock_instance

        resp = client.post(
            "/send-email",
            json={"to_email": "user@example.com", "subject": "Test", "body": "<p>Hello</p>"},
        )

    assert resp.status_code == 200
    assert resp.get_json()["message"] == "Email notification queued successfully"
    mock_thread_cls.assert_called_once()
    mock_instance.start.assert_called_once()


def test_send_email_success_passes_correct_args(client):
    captured = {}

    def fake_thread(target, args):
        captured["target"] = target
        captured["args"] = args
        return MagicMock()

    with patch("threading.Thread", side_effect=fake_thread):
        client.post(
            "/send-email",
            json={"to_email": "x@y.com", "subject": "Subj", "body": "Bd"},
        )

    assert captured["args"] == ("x@y.com", "Subj", "Bd")
