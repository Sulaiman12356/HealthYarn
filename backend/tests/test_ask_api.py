"""Tests for POST /api/ask outcomes, upload bounds, STT timeout, and NDPA privacy."""

from sqlmodel import select

from app.config import get_settings
from app.models import QueryLog


def test_ask_all_four_outcomes_with_mock_stt(client):
    # 1. answer
    r_ans = client.post(
        "/api/ask",
        files={"audio": ("q.webm", b"MOCK:how to mix ors", "audio/webm")},
        data={"lang": "en", "duration_seconds": "2.5"},
    )
    assert r_ans.status_code == 200
    assert r_ans.json()["type"] == "answer"
    assert r_ans.json()["intent_key"] == "ors_how_to_prepare"

    # 2. red_flag
    r_rf = client.post(
        "/api/ask",
        files={"audio": ("q.webm", b"MOCK:my child is having convulsions", "audio/webm")},
        data={"lang": "en", "duration_seconds": "2.0"},
    )
    assert r_rf.status_code == 200
    assert r_rf.json()["type"] == "red_flag"
    assert len(r_rf.json()["clinics"]) >= 1

    # 3. unsure
    r_uns = client.post(
        "/api/ask",
        files={"audio": ("q.webm", b"MOCK:price of tomatoes in mile 12", "audio/webm")},
        data={"lang": "en", "duration_seconds": "2.0"},
    )
    assert r_uns.status_code == 200
    assert r_uns.json()["type"] == "unsure"
    assert len(r_uns.json()["candidates"]) == 3

    # 4. stt_failed (timeout & provider error)
    r_to = client.post(
        "/api/ask",
        files={"audio": ("q.webm", b"MOCK:TIMEOUT", "audio/webm")},
        data={"lang": "en", "duration_seconds": "2.0"},
    )
    assert r_to.status_code == 200
    assert r_to.json()["type"] == "error"
    assert r_to.json()["code"] == "stt_failed"


def test_ask_rejects_oversized_overlong_and_bad_mime(client):
    # Oversized > 1 MB
    big_bytes = b"0" * (1_048_576 + 100)
    r_big = client.post(
        "/api/ask",
        files={"audio": ("big.webm", big_bytes, "audio/webm")},
        data={"lang": "en"},
    )
    assert r_big.status_code == 413

    # Overlong > 15s
    r_long = client.post(
        "/api/ask",
        files={"audio": ("long.webm", b"MOCK:hello", "audio/webm")},
        data={"lang": "en", "duration_seconds": "18.5"},
    )
    assert r_long.status_code == 400

    # Unsupported MIME
    r_mime = client.post(
        "/api/ask",
        files={"audio": ("bad.txt", b"hello", "text/plain")},
        data={"lang": "en"},
    )
    assert r_mime.status_code == 400


def test_privacy_20_queries_leave_zero_audio_and_zero_transcripts(client, seeded_session):
    settings = get_settings()
    audio_dir = settings.static_audio_dir
    before_files = set(audio_dir.rglob("*")) if audio_dir.exists() else set()

    for i in range(20):
        resp = client.post(
            "/api/ask",
            files={"audio": (f"q{i}.webm", f"MOCK:how to mix ors {i}".encode(), "audio/webm")},
            data={"lang": "en", "duration_seconds": "1.5"},
        )
        assert resp.status_code == 200

    after_files = set(audio_dir.rglob("*")) if audio_dir.exists() else set()
    assert after_files == before_files, "No voice recording may ever be written to disk!"

    logs = seeded_session.exec(select(QueryLog)).all()
    assert len(logs) == 20
    for log_row in logs:
        assert log_row.unmatched_text is None
