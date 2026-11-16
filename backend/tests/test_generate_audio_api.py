"""Tests for YarnGPT REST API integration in scripts/generate_audio.py."""

import json
import httpx
from sqlmodel import select

from app.models import FAQItem, SystemMessage, Translation
from scripts.generate_audio import (
    LOCAL_GPU_VOICE_MAP,
    YarnGPTAPIClient,
    run_generation,
)


def test_local_gpu_uses_v2_speaker_names(tmp_path, seeded_session, monkeypatch):
    seen_calls: list[tuple[str, str, str]] = []

    def fake_synth(chunk: str, lang: str, voice: str):
        seen_calls.append((chunk, lang, voice))
        import numpy as np

        return np.zeros(2400, dtype=np.float32), 24000

    monkeypatch.setattr("scripts.generate_audio.build_yarngpt_synthesizer", lambda: fake_synth)

    summary = run_generation(
        seeded_session,
        out_root=tmp_path,
        only_missing=False,
        lang_filter="yo",
        takes=2,
        demo_synth=False,
        use_api=False,
    )
    assert summary["mode"] == "local_gpu"
    assert summary["files_created"] > 0
    used_voices = {v for _, _, v in seen_calls}
    assert used_voices.issubset(set(LOCAL_GPU_VOICE_MAP["yo"]))
    assert "folake" not in used_voices  # Hosted API names must not be sent to local AudioTokenizerV2


def test_yarngpt_api_prepare_stream_with_303_and_dynamic_voices(tmp_path, seeded_session):
    seen_requests: list[tuple[str, str, dict, bytes]] = []
    fake_opus = b"OggS" + (b"\x01" * 120)

    def auth_handler(request: httpx.Request) -> httpx.Response:
        seen_requests.append((request.method, str(request.url), dict(request.headers), request.content))
        assert request.headers.get("authorization") == "Bearer test_key_123"
        if request.url.path == "/api/v1/voices":
            return httpx.Response(
                200,
                json={
                    "voices": [
                        {"id": "Folake", "languages": ["yo"], "default": False},
                        {"id": "Chioma", "languages": ["ig"], "default": False},
                        {"id": "Idera", "languages": ["en"], "default": True},
                    ]
                },
            )
        if request.url.path == "/api/v1/tts/prepare":
            body = json.loads(request.content.decode("utf-8"))
            assert "target_language" not in body  # Hard rule: never translate medical text
            assert body["output_format"] == "opus"
            return httpx.Response(
                202,
                json={
                    "ticket": "tkt_abc123",
                    "stream_url": "/api/v1/tts/stream/tkt_abc123",
                    "expires_in": 300,
                },
            )
        return httpx.Response(404)

    def public_handler(request: httpx.Request) -> httpx.Response:
        seen_requests.append((request.method, str(request.url), dict(request.headers), b""))
        # Stream ticket leg MUST NOT leak Authorization header
        assert "authorization" not in {k.lower() for k in request.headers.keys()}
        if request.url.path == "/api/v1/tts/stream/tkt_abc123":
            return httpx.Response(
                303,
                headers={"Location": "https://cdn.yarngpt.example/signed/clip.ogg"},
            )
        if str(request.url) == "https://cdn.yarngpt.example/signed/clip.ogg":
            return httpx.Response(200, content=fake_opus, headers={"Content-Type": "audio/ogg"})
        return httpx.Response(404)

    auth_client = httpx.Client(transport=httpx.MockTransport(auth_handler))
    public_client = httpx.Client(transport=httpx.MockTransport(public_handler), follow_redirects=True)
    api = YarnGPTAPIClient("test_key_123", "https://api.yarngpt.ai", auth_client=auth_client, public_client=public_client)

    summary = run_generation(
        seeded_session,
        out_root=tmp_path,
        only_missing=True,
        lang_filter="yo",
        takes=1,
        use_api=True,
        api_mode="prepare",
        output_format="opus",
        api_client=api,
    )
    assert summary["mode"] == "api"
    assert summary["format"] == "ogg"
    assert summary["files_created"] > 0

    yo_tr = seeded_session.exec(select(Translation).where(Translation.lang == "yo")).first()
    assert yo_tr is not None
    assert yo_tr.answer_audio_url and yo_tr.answer_audio_url.endswith(".ogg")
    assert yo_tr.voice_name == "Folake"  # Exact case-sensitive ID resolved from catalogue

    # Second run with --only-missing must skip every already-generated .ogg file
    summary2 = run_generation(
        seeded_session,
        out_root=tmp_path,
        only_missing=True,
        lang_filter="yo",
        takes=1,
        use_api=True,
        api_mode="prepare",
        output_format="opus",
        api_client=api,
    )
    assert summary2["files_created"] == 0


def test_yarngpt_api_job_polling_with_idempotency():
    poll_count = 0
    fake_mp3 = b"ID3" + (b"\x02" * 120)

    def auth_handler(request: httpx.Request) -> httpx.Response:
        nonlocal poll_count
        if request.url.path == "/api/v1/tts":
            idem = request.headers.get("idempotency-key", "")
            assert 1 <= len(idem) <= 64 and ":" not in idem
            body = json.loads(request.content.decode("utf-8"))
            assert body["output_format"] == "mp3"
            return httpx.Response(202, json={"job_id": "job_99", "status": "queued"})
        if request.url.path == "/api/v1/status/job_99":
            poll_count += 1
            if poll_count == 1:
                return httpx.Response(200, json={"status": "processing", "percentage": 40})
            return httpx.Response(
                200,
                json={
                    "status": "completed",
                    "percentage": 100,
                    "audio_url": "https://cdn.yarngpt.example/job_99.mp3",
                },
            )
        return httpx.Response(404)

    def public_handler(request: httpx.Request) -> httpx.Response:
        assert "authorization" not in {k.lower() for k in request.headers.keys()}
        return httpx.Response(200, content=fake_mp3)

    api = YarnGPTAPIClient(
        "test_key_123",
        "https://api.yarngpt.ai",
        auth_client=httpx.Client(transport=httpx.MockTransport(auth_handler)),
        public_client=httpx.Client(transport=httpx.MockTransport(public_handler), follow_redirects=True),
        sleep_fn=lambda _: None,
    )
    audio_bytes = api.synthesize_job(
        "Hello HealthYarn",
        voice="Idera",
        output_format="mp3",
        idempotency_key="hy-test-job-99",
    )
    assert audio_bytes == fake_mp3
    assert poll_count == 2
