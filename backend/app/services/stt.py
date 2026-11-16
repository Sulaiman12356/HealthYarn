"""Pluggable Speech-to-Text (STTProvider) interface and implementations."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod

from app.config import Settings


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
            resp = client.speech.transcribe(language=api_lang, content=audio_bytes)
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


def get_stt_provider(settings: Settings) -> STTProvider:
    provider = settings.STT_PROVIDER.strip().lower()
    if provider == "spitch":
        return SpitchSTT(api_key=settings.SPITCH_API_KEY, timeout_seconds=settings.STT_TIMEOUT_SECONDS)
    if provider == "hf":
        return HFSTT(timeout_seconds=settings.STT_TIMEOUT_SECONDS)
    return MockSTT()
