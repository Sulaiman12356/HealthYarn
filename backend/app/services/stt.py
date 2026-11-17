"""Pluggable Speech-to-Text (STTProvider) interface and implementations."""

from __future__ import annotations

import asyncio
import time
import uuid
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from app.config import Settings

YARNGPT_ASR_LANG_MAP: dict[str, str] = {
    "en": "english",
    "yo": "yoruba",
    "pcm": "pidgin",
}


class STTError(Exception):
    """Raised when transcription fails."""


class STTTimeoutError(STTError):
    """Raised when transcription exceeds timeout."""


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
        """Transcribe raw audio bytes in memory and return text."""


class MockSTT(STTProvider):
    """Deterministic STT provider for automated tests and offline/demo fallback."""

    PRESETS: dict[str, list[str]] = {
        "en": [
            "How do I prepare ORS for my child?",
            "Should I take malaria drugs before getting tested?",
            "Can I have high blood pressure without feeling sick?",
        ],
        "yo": [
            "bawo ni a se n po ors",
            "se kin lo ogun iba lai se ayewo",
            "se ifunpa giga ma n se aisi ami",
        ],
        "pcm": [
            "how i go mix ors water for my pikin wey dey purge",
            "i fit buy malaria drug without doing test",
            "bp fit high even if body no dey pain person",
        ],
    }

    def __init__(self) -> None:
        self._counter = 0

    async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
        if not audio_bytes:
            raise STTError("Empty audio buffer")

        if audio_bytes.startswith(b"MOCK:"):
            directive = audio_bytes[len(b"MOCK:") :].decode("utf-8", errors="ignore").strip()
            if directive == "TIMEOUT":
                raise STTTimeoutError("Mock STT timeout")
            if directive == "FAIL":
                raise STTError("Mock STT failure")
            if directive:
                return directive

        choices = self.PRESETS.get(lang, self.PRESETS["en"])
        phrase = choices[self._counter % len(choices)]
        self._counter += 1
        return phrase


def _infer_audio_mime(filename: str) -> str:
    lower = (filename or "").strip().lower()
    if lower.endswith(".ogg"):
        return "audio/ogg"
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".mp4") or lower.endswith(".m4a"):
        return "audio/mp4"
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".flac"):
        return "audio/flac"
    return "audio/webm"


class YarnGPTSTT(STTProvider):
    """YarnGPT Speech-to-Text provider supporting Nigerian English, Pidgin, and Yorùbá."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.yarngpt.ai",
        timeout_seconds: float = 15.0,
        poll_interval_seconds: float = 0.4,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self._transport = transport

    async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
        if not audio_bytes:
            raise STTError("Empty audio buffer")
        if not self.api_key or self.api_key == "TODO":
            raise STTError("YARNGPT_API_KEY is not configured")

        upload_name = filename.strip() if filename and filename.strip() else "audio.webm"
        mime = _infer_audio_mime(upload_name)
        api_lang = YARNGPT_ASR_LANG_MAP.get(lang.strip().lower(), "english")
        headers = {"Authorization": f"Bearer {self.api_key}"}

        deadline = time.monotonic() + self.timeout_seconds
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout_seconds,
                transport=self._transport,
            ) as client:
                up = await client.post(
                    "/api/v1/asr",
                    headers={**headers, "Idempotency-Key": uuid.uuid4().hex},
                    files={"file": (upload_name, audio_bytes, mime)},
                    data={"language": api_lang},
                )
                if up.status_code >= 400:
                    raise STTError(f"YarnGPT ASR upload failed ({up.status_code}): {up.text[:240]}")

                payload = up.json()
                if payload.get("status") == "completed" and payload.get("transcript"):
                    return str(payload["transcript"]).strip()

                job_id = payload.get("job_id") or payload.get("id")
                if not job_id:
                    raise STTError("YarnGPT ASR response missing job_id")

                while time.monotonic() < deadline:
                    await asyncio.sleep(self.poll_interval_seconds)
                    poll = await client.get(f"/api/v1/asr/{job_id}", headers=headers)
                    if poll.status_code >= 400:
                        raise STTError(
                            f"YarnGPT ASR poll failed ({poll.status_code}): {poll.text[:240]}"
                        )
                    st = poll.json()
                    status = str(st.get("status") or "").lower()
                    if status in ("completed", "succeeded"):
                        text = str(st.get("transcript") or "").strip()
                        if not text:
                            raise STTError("YarnGPT ASR returned empty transcript")
                        return text
                    if status in ("failed", "error"):
                        code = st.get("error_code") or "ASR_FAILED"
                        raise STTError(f"YarnGPT ASR failed ({code})")

                raise STTTimeoutError("YarnGPT ASR polling timed out")
        except STTError:
            raise
        except httpx.TimeoutException as exc:
            raise STTTimeoutError("YarnGPT STT request timed out") from exc
        except Exception as exc:
            raise STTError(f"YarnGPT STT failed: {exc}") from exc


class SpitchSTT(STTProvider):
    """Official Spitch SDK Speech-to-Text provider for Yorùbá, Igbo, and Nigerian English."""

    def __init__(self, api_key: str, timeout_seconds: float = 8.0) -> None:
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
        if not self.api_key or self.api_key == "TODO":
            raise STTError("SPITCH_API_KEY is not configured")

        from spitch import Spitch  # type: ignore

        def _call_sync() -> str:
            client = Spitch(api_key=self.api_key)
            api_lang = "en" if lang == "pcm" else lang
            upload_name = filename.strip() if filename and filename.strip() else "audio.webm"
            resp = client.speech.transcribe(
                language=api_lang,
                content=(upload_name, audio_bytes),
            )
            text = getattr(resp, "text", "") or ""
            return text.strip()

        try:
            text = await asyncio.wait_for(asyncio.to_thread(_call_sync), timeout=self.timeout_seconds)
        except asyncio.TimeoutError as exc:
            raise STTTimeoutError("Spitch STT request timed out") from exc
        except Exception as exc:
            raise STTError(f"Spitch STT failed: {exc}") from exc

        if not text:
            raise STTError("Spitch STT returned empty transcript")
        return text


class HFSTT(STTProvider):
    """Optional Hugging Face ASR provider loaded only when STT_PROVIDER=hf."""

    def __init__(self, model_name: str = "openai/whisper-small", timeout_seconds: float = 8.0) -> None:
        self.model_name = model_name
        self.timeout_seconds = timeout_seconds
        self._pipeline = None

    def _get_pipeline(self):
        if self._pipeline is None:
            from transformers import pipeline  # type: ignore

            self._pipeline = pipeline("automatic-speech-recognition", model=self.model_name)
        return self._pipeline

    async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
        def _run_sync() -> str:
            asr = self._get_pipeline()
            result = asr(audio_bytes)
            return (result.get("text", "") if isinstance(result, dict) else "").strip()

        try:
            text = await asyncio.wait_for(asyncio.to_thread(_run_sync), timeout=self.timeout_seconds)
        except asyncio.TimeoutError as exc:
            raise STTTimeoutError("HF STT timed out") from exc
        except Exception as exc:
            raise STTError(f"HF STT failed: {exc}") from exc

        if not text:
            raise STTError("HF STT returned empty transcript")
        return text


class FallbackSTT(STTProvider):
    """Tries primary STT provider and transparently falls back on any STTError."""

    def __init__(self, primary: STTProvider, fallback: STTProvider) -> None:
        self.primary = primary
        self.fallback = fallback

    async def transcribe(self, audio_bytes: bytes, lang: str, filename: str = "audio.webm") -> str:
        try:
            return await self.primary.transcribe(audio_bytes, lang, filename=filename)
        except STTError:
            return await self.fallback.transcribe(audio_bytes, lang, filename=filename)


def get_stt_provider(settings: Settings) -> STTProvider:
    provider = settings.STT_PROVIDER.strip().lower()
    if provider == "yarngpt":
        primary = YarnGPTSTT(
            api_key=settings.YARNGPT_API_KEY,
            base_url=settings.YARNGPT_BASE_URL,
            timeout_seconds=settings.STT_TIMEOUT_SECONDS,
        )
        spitch_key = (settings.SPITCH_API_KEY or "").strip()
        if spitch_key and spitch_key != "TODO":
            return FallbackSTT(
                primary=primary,
                fallback=SpitchSTT(api_key=spitch_key, timeout_seconds=settings.STT_TIMEOUT_SECONDS),
            )
        return primary
    if provider == "spitch":
        return SpitchSTT(api_key=settings.SPITCH_API_KEY, timeout_seconds=settings.STT_TIMEOUT_SECONDS)
    if provider == "hf":
        return HFSTT(timeout_seconds=settings.STT_TIMEOUT_SECONDS)
    return MockSTT()
