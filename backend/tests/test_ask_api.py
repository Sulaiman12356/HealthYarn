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


def test_spitch_stt_passes_filename_tuple(monkeypatch):
    import asyncio
    import sys
    import types
    from app.services.stt import SpitchSTT

    captured = {}

    class FakeResp:
        text = "  how i go mix ors water  "

    class FakeSpeech:
        def transcribe(self, *, language, content):
            captured["language"] = language
            captured["content"] = content
            return FakeResp()

    class FakeSpitch:
        def __init__(self, api_key):
            captured["api_key"] = api_key
            self.speech = FakeSpeech()

    monkeypatch.setitem(sys.modules, "spitch", types.SimpleNamespace(Spitch=FakeSpitch))
    provider = SpitchSTT(api_key="test-key", timeout_seconds=5.0)
    result = asyncio.run(provider.transcribe(b"webm-bytes", "pcm", filename="question.webm"))

    assert result == "how i go mix ors water"
    assert captured["language"] == "en"
    assert captured["content"] == ("question.webm", b"webm-bytes")


def test_yarngpt_stt_maps_languages_and_polls_job():
    import asyncio
    import json
    import httpx
    from app.services.stt import YarnGPTSTT

    seen = {"posts": [], "polls": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/api/v1/asr":
            body_text = request.content.decode("latin1", errors="ignore")
            seen["posts"].append((request.headers.get("Idempotency-Key"), body_text))
            return httpx.Response(202, json={"job_id": "job-123", "status": "queued"})
        if request.method == "GET" and request.url.path == "/api/v1/asr/job-123":
            seen["polls"] += 1
            if seen["polls"] == 1:
                return httpx.Response(200, json={"job_id": "job-123", "status": "processing"})
            return httpx.Response(
                200,
                json={
                    "job_id": "job-123",
                    "status": "completed",
                    "transcript": "  how i go mix ors water  ",
                },
            )
        return httpx.Response(404, json={"detail": "not found"})

    provider = YarnGPTSTT(
        api_key="test-key",
        timeout_seconds=5.0,
        poll_interval_seconds=0.01,
        transport=httpx.MockTransport(handler),
    )
    out = asyncio.run(provider.transcribe(b"RIFF....", "pcm", filename="question.wav"))
    assert out == "how i go mix ors water"
    assert seen["polls"] == 2
    assert seen["posts"][0][0]  # Idempotency-Key sent
    assert "pidgin" in seen["posts"][0][1]


def test_yarngpt_stt_error_triggers_fallback_stt():
    import asyncio
    import httpx
    from app.services.stt import FallbackSTT, STTProvider, YarnGPTSTT

    def fail_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(402, json={"error": {"code": "QUOTA_EXCEEDED"}})

    class StubFallback(STTProvider):
        async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
            return f"fallback:{lang}:{filename}"

    combo = FallbackSTT(
        primary=YarnGPTSTT(
            api_key="k",
            timeout_seconds=5.0,
            poll_interval_seconds=0.01,
            transport=httpx.MockTransport(fail_handler),
        ),
        fallback=StubFallback(),
    )
    out = asyncio.run(combo.transcribe(b"audio", "yo", filename="q.ogg"))
    assert out == "fallback:yo:q.ogg"


