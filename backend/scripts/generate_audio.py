"""Offline batch audio synthesis pipeline for HealthYarn.

Supports three backends:
  1. YarnGPT Hosted API (`--api`, uses `YARNGPT_API_KEY` from `.env` via
     `POST /api/v1/tts/prepare` + `GET /api/v1/tts/stream/{ticket}` or
     `POST /api/v1/tts` + `GET /api/v1/status/{job_id}`).
  2. Local / Colab YarnGPT GPU (`saheedniyi/YarnGPT2b` + `ffmpeg` Opus).
  3. Local Offline Demo Synth (`--demo-synth`, lightweight tone waveforms).

Usage:
  python -m scripts.generate_audio --api --list-voices
  python -m scripts.generate_audio --api --only-missing
  python -m scripts.generate_audio --api --lang yo --takes 2 --format opus
  python -m scripts.generate_audio --demo-synth --takes 2
"""

from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path
from typing import Callable, Optional

import httpx
import numpy as np
from sqlmodel import Session, select

from app.config import get_settings
from app.db import engine, init_db
from app.models import PLACEHOLDER_PREFIX, FAQItem, SystemMessage, Translation, utc_now

# Preferred speaker names (resolved dynamically against GET /api/v1/voices in API mode)
DEFAULT_VOICE_MAP: dict[str, list[str]] = {
    "yo": ["folake", "wura", "idera"],
    "pcm": ["idera", "emma", "jude"],
    "en": ["idera", "emma", "jude", "umar"],
}

# Verified Spitch TTS voices (sade/funmi/segun for yo; ufoma/boma/tega for pcm; remi/lina/jude for en)
SPITCH_VOICE_MAP: dict[str, list[str]] = {
    "yo": ["sade", "funmi", "segun"],
    "pcm": ["ufoma", "boma", "tega"],
    "en": ["remi", "lina", "jude"],
}

# Verified JSON speaker filenames in saheedniyi02/yarngpt (AudioTokenizerV2)
LOCAL_GPU_VOICE_MAP: dict[str, list[str]] = {
    "yo": ["yoruba_female1", "yoruba_female2", "yoruba_male2"],
    "pcm": ["idera", "emma", "jude"],
    "en": ["idera", "emma", "jude", "umar"],
}

YARNGPT_LANG_NAMES: dict[str, str] = {
    "yo": "yoruba",
    "ig": "igbo",
    "en": "english",
}

API_FORMAT_TO_EXT: dict[str, str] = {
    "opus": "ogg",
    "mp3": "mp3",
    "wav": "wav",
}


class YarnGPTAPIError(RuntimeError):
    """Structured error raised from the YarnGPT REST API."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 0,
        code: str = "API_ERROR",
        trace_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.trace_id = trace_id


def strip_placeholder_prefix(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith(PLACEHOLDER_PREFIX):
        cleaned = cleaned[len(PLACEHOLDER_PREFIX) :].strip()
    return cleaned


def split_into_chunks(text: str, max_words: int = 25) -> list[str]:
    """Split text at sentence punctuation while keeping every chunk <= max_words."""
    cleaned = re.sub(r"\s+", " ", strip_placeholder_prefix(text)).strip()
    if not cleaned:
        return []

    sentences = [s.strip() for s in re.split(r"(?<=[.?!])\s+", cleaned) if s.strip()]
    chunks: list[str] = []
    for sentence in sentences:
        words = sentence.split()
        if len(words) <= max_words:
            chunks.append(sentence)
        else:
            for i in range(0, len(words), max_words):
                chunks.append(" ".join(words[i : i + max_words]))
    return chunks


def text_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]


def _extract_error(resp: httpx.Response) -> YarnGPTAPIError:
    trace_id = resp.headers.get("X-Request-Id")
    try:
        data = resp.json()
    except Exception:
        return YarnGPTAPIError(
            f"HTTP {resp.status_code}: {resp.text[:240]}",
            status_code=resp.status_code,
            trace_id=trace_id,
        )
    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict):
        code = str(err.get("code") or "API_ERROR")
        trace_id = str(err.get("trace_id") or trace_id or "")
        msg = str(err.get("user_message") or err.get("message") or resp.text[:200])
        return YarnGPTAPIError(
            f"[{code}] {msg} (trace_id={trace_id or 'n/a'})",
            status_code=resp.status_code,
            code=code,
            trace_id=trace_id or None,
        )
    return YarnGPTAPIError(
        f"HTTP {resp.status_code}: {data}",
        status_code=resp.status_code,
        trace_id=trace_id,
    )


def _retry_delay_seconds(resp: httpx.Response, default: float = 1.5) -> float:
    hdr = resp.headers.get("Retry-After")
    if hdr:
        try:
            return min(15.0, max(0.5, float(hdr)))
        except ValueError:
            pass
    try:
        data = resp.json()
        sec = data.get("error", {}).get("details", {}).get("retry_after_seconds")
        if sec is not None:
            return min(15.0, max(0.5, float(sec)))
    except Exception:
        pass
    return default


class YarnGPTAPIClient:
    """Official YarnGPT REST API client following https://yarngpt.ai/api-docs."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.yarngpt.ai",
        *,
        auth_client: Optional[httpx.Client] = None,
        public_client: Optional[httpx.Client] = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key or api_key == "TODO":
            raise ValueError("YARNGPT_API_KEY is not configured. Set it in .env.")
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.sleep_fn = sleep_fn
        self._owns_clients = auth_client is None and public_client is None
        self.auth_client = auth_client or httpx.Client(timeout=60.0)
        # Stream tickets & signed audio URLs carry credentials in path/query and MUST NOT send Authorization
        self.public_client = public_client or httpx.Client(timeout=90.0, follow_redirects=True)

    def close(self) -> None:
        if self._owns_clients:
            self.auth_client.close()
            self.public_client.close()

    def _auth_headers(self, extra: Optional[dict[str, str]] = None) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if extra:
            headers.update(extra)
        return headers

    def list_voices(self) -> list[dict]:
        resp = self.auth_client.get(
            f"{self.base_url}/api/v1/voices",
            headers=self._auth_headers(),
        )
        if resp.status_code >= 400:
            raise _extract_error(resp)
        payload = resp.json()
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("voices", "data", "items"):
                if isinstance(payload.get(key), list):
                    return payload[key]
        return []

    @staticmethod
    def _voice_id(entry: dict) -> Optional[str]:
        for key in ("id", "voice", "name"):
            val = entry.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        return None

    def resolve_voice(self, lang: str, take_idx: int, catalogue: list[dict]) -> Optional[str]:
        if not catalogue:
            return None

        id_by_lower: dict[str, str] = {}
        lang_matches: list[str] = []
        default_id: Optional[str] = None
        lang_aliases = {lang.lower(), YARNGPT_LANG_NAMES.get(lang.lower(), "")}

        for entry in catalogue:
            vid = self._voice_id(entry)
            if not vid:
                continue
            id_by_lower[vid.lower()] = vid
            if entry.get("default") is True and default_id is None:
                default_id = vid

            entry_langs = entry.get("languages") or entry.get("language") or []
            if isinstance(entry_langs, str):
                entry_langs = [entry_langs]
            normalized_langs = {str(x).strip().lower() for x in entry_langs}
            if normalized_langs & lang_aliases:
                lang_matches.append(vid)

        preferred = DEFAULT_VOICE_MAP.get(lang, [])
        ordered_prefs = preferred[take_idx:] + preferred[:take_idx]
        for pref in ordered_prefs:
            if pref.lower() in id_by_lower:
                return id_by_lower[pref.lower()]

        if lang_matches:
            return lang_matches[take_idx % len(lang_matches)]

        return default_id

    def synthesize_prepare(
        self,
        text: str,
        *,
        voice: Optional[str],
        output_format: str = "opus",
    ) -> bytes:
        clean_text = strip_placeholder_prefix(text)
        body: dict[str, str] = {
            "text": clean_text,
            "output_format": output_format,
        }
        if voice:
            body["voice"] = voice

        prep_resp: Optional[httpx.Response] = None
        for attempt in range(2):
            prep_resp = self.auth_client.post(
                f"{self.base_url}/api/v1/tts/prepare",
                headers=self._auth_headers({"Content-Type": "application/json"}),
                json=body,
            )
            if prep_resp.status_code in {500, 502, 503, 504} and attempt == 0:
                self.sleep_fn(1.5)
                continue
            if prep_resp.status_code == 429 and attempt == 0:
                self.sleep_fn(_retry_delay_seconds(prep_resp))
                continue
            break

        assert prep_resp is not None
        if prep_resp.status_code >= 400:
            raise _extract_error(prep_resp)

        prep_data = prep_resp.json()
        stream_path = str(prep_data.get("stream_url") or "")
        if not stream_path:
            ticket = prep_data.get("ticket", "")
            stream_path = f"/api/v1/tts/stream/{ticket}"
        stream_url = stream_path if stream_path.startswith("http") else f"{self.base_url}{stream_path}"

        for attempt in range(2):
            audio_resp = self.public_client.get(stream_url)
            if audio_resp.status_code == 503 and attempt == 0:
                self.sleep_fn(_retry_delay_seconds(audio_resp, default=2.0))
                continue
            if audio_resp.status_code >= 400:
                raise _extract_error(audio_resp)
            if audio_resp.headers.get("X-Yarn-Partial") == "1":
                raise YarnGPTAPIError("Stream returned partial audio (X-Yarn-Partial: 1)")
            if len(audio_resp.content.strip()) <= 64:
                raise YarnGPTAPIError("Stream returned empty or truncated audio bytes")
            return audio_resp.content

        raise YarnGPTAPIError("Failed to fetch prepared audio stream")

    def synthesize_job(
        self,
        text: str,
        *,
        voice: Optional[str],
        output_format: str = "mp3",
        idempotency_key: str,
    ) -> bytes:
        job_format = "mp3" if output_format == "opus" else output_format
        clean_text = strip_placeholder_prefix(text)
        safe_idem = re.sub(r"[^A-Za-z0-9_-]", "-", idempotency_key)[:64]

        body: dict[str, str] = {
            "text": clean_text,
            "output_format": job_format,
        }
        if voice:
            body["voice"] = voice

        post_resp: Optional[httpx.Response] = None
        for attempt in range(3):
            post_resp = self.auth_client.post(
                f"{self.base_url}/api/v1/tts",
                headers=self._auth_headers(
                    {
                        "Content-Type": "application/json",
                        "Idempotency-Key": safe_idem,
                    }
                ),
                json=body,
            )
            if post_resp.status_code in {409, 500, 502, 503, 504} and attempt < 2:
                self.sleep_fn(1.5)
                continue
            if post_resp.status_code == 429 and attempt < 2:
                self.sleep_fn(_retry_delay_seconds(post_resp))
                continue
            break

        assert post_resp is not None
        if post_resp.status_code >= 400:
            raise _extract_error(post_resp)

        job_id = post_resp.json()["job_id"]
        delay = 1.0
        for _ in range(45):
            status_resp = self.auth_client.get(
                f"{self.base_url}/api/v1/status/{job_id}",
                headers=self._auth_headers(),
            )
            if status_resp.status_code >= 400:
                raise _extract_error(status_resp)
            st_data = status_resp.json()
            state = st_data.get("status")
            if state == "completed":
                audio_url = st_data.get("audio_url")
                if not audio_url:
                    raise YarnGPTAPIError(f"Job {job_id} completed without audio_url")
                dl = self.public_client.get(audio_url)
                if dl.status_code >= 400:
                    raise _extract_error(dl)
                if len(dl.content.strip()) <= 64:
                    raise YarnGPTAPIError(f"Job {job_id} audio_url returned empty body")
                return dl.content
            if state == "failed":
                msg = st_data.get("user_message") or st_data.get("message") or "TTS job failed"
                raise YarnGPTAPIError(f"Job {job_id} failed: {msg}")
            self.sleep_fn(delay)
            delay = min(5.0, delay * 1.4)

        raise YarnGPTAPIError(f"Timed out waiting for TTS job {job_id}")


class SpitchTTSClient:
    """Offline batch TTS using official Spitch SDK (`client.speech.generate`)."""

    def __init__(self, api_key: str, *, sleep_fn: Callable[[float], None] = time.sleep) -> None:
        if not api_key or api_key == "TODO":
            raise ValueError("SPITCH_API_KEY is not configured. Set it in .env.")
        from spitch import Spitch  # type: ignore

        self._client = Spitch(api_key=api_key.strip())
        self.sleep_fn = sleep_fn

    def synthesize(self, text: str, *, lang: str, voice: str) -> bytes:
        clean_text = strip_placeholder_prefix(text)
        api_lang = "en" if lang == "pcm" else lang
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                resp = self._client.speech.generate(
                    text=clean_text,
                    voice=voice,  # type: ignore[arg-type]
                    language=api_lang,
                    format="ogg_opus",
                )
                audio_bytes = resp.read()
                if len(audio_bytes) <= 64:
                    raise YarnGPTAPIError("Spitch TTS returned empty audio payload")
                return audio_bytes
            except Exception as exc:
                last_exc = exc
                status_code = getattr(exc, "status_code", None)
                err_text = str(exc).lower()
                if status_code in (400, 401, 402, 403, 404, 422) or "insufficient_credits" in err_text:
                    raise YarnGPTAPIError(f"Spitch TTS failed: {exc}") from exc
                if attempt < 2:
                    self.sleep_fn(1.5 * (attempt + 1))
                    continue
        raise YarnGPTAPIError(f"Spitch TTS failed after retries: {last_exc}")


def render_text_via_spitch(
    client: SpitchTTSClient,
    text: str,
    lang: str,
    intent_key: str,
    kind: str,
    voice: str,
    take_idx: int,
    out_root: Path,
    *,
    reuse_existing: bool = False,
) -> tuple[str, Path]:
    digest = text_hash(text)
    take_suffix = f"_take{take_idx + 1}" if take_idx > 0 else ""
    base_name = f"{intent_key}_{kind}_{digest}{take_suffix}"
    target_dir = out_root / lang
    target_dir.mkdir(parents=True, exist_ok=True)
    out_file = target_dir / f"{base_name}.ogg"

    if reuse_existing and out_file.exists() and out_file.stat().st_size > 64:
        return f"/static/audio/{lang}/{out_file.name}", out_file

    audio_bytes = client.synthesize(text, lang=lang, voice=voice)
    out_file.write_bytes(audio_bytes)
    url = f"/static/audio/{lang}/{out_file.name}"
    return url, out_file


def normalize_waveform(samples: np.ndarray, target_peak: float = 0.85) -> np.ndarray:
    if samples.size == 0:
        return samples
    peak = float(np.max(np.abs(samples)))
    if peak < 1e-6:
        return samples
    return (samples / peak) * target_peak


def write_wav(path: Path, samples: np.ndarray, sample_rate: int = 24000) -> None:
    clipped = np.clip(samples, -1.0, 1.0)
    pcm16 = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())


def synthesize_demo_chunk(chunk: str, lang: str, take_idx: int, sample_rate: int = 16000) -> np.ndarray:
    """Create a gentle, distinct, speech-cadence tone sequence for local offline demos."""
    words = max(2, min(14, len(chunk.split())))
    base_freq = {"yo": 220.0, "pcm": 246.94, "en": 196.0}.get(lang, 220.0)
    base_freq += take_idx * 18.0
    parts: list[np.ndarray] = []
    rng = int(hashlib.sha1(chunk.encode("utf-8")).hexdigest()[:6], 16)

    for idx in range(words):
        syllable_dur = 0.08 + ((rng >> (idx % 12)) & 3) * 0.015
        n_samples = int(sample_rate * syllable_dur)
        t = np.linspace(0.0, syllable_dur, n_samples, endpoint=False)
        tone_step = ((rng + idx * 7) % 5) - 2
        freq = base_freq * (2.0 ** (tone_step / 12.0))
        env = np.sin(np.pi * np.linspace(0.0, 1.0, n_samples)) ** 0.8
        wave_chunk = (
            0.55 * np.sin(2.0 * math.pi * freq * t)
            + 0.25 * np.sin(2.0 * math.pi * freq * 2.0 * t)
        ) * env
        parts.append(wave_chunk.astype(np.float32))
        parts.append(np.zeros(int(sample_rate * 0.03), dtype=np.float32))

    return np.concatenate(parts) if parts else np.zeros(int(sample_rate * 0.3), dtype=np.float32)


def _find_wavtokenizer_paths() -> tuple[str, str]:
    cfg_name = "wavtokenizer_mediumdata_frame75_3s_nq1_code4096_dim512_kmeans200_attn.yaml"
    ckpt_name = "wavtokenizer_large_speech_320_24k.ckpt"
    search_dirs = [
        Path.cwd(),
        Path("/content"),
        Path.home() / ".yarngpt" / "models",
    ]
    cfg_path = next((str(d / cfg_name) for d in search_dirs if (d / cfg_name).exists()), cfg_name)
    ckpt_path = next((str(d / ckpt_name) for d in search_dirs if (d / ckpt_name).exists()), ckpt_name)
    return cfg_path, ckpt_path


def _import_audio_tokenizer_v2():
    yarngpt_repo = Path("/content/yarngpt_repo")
    if yarngpt_repo.exists() and str(yarngpt_repo) not in sys.path:
        sys.path.insert(0, str(yarngpt_repo))
    try:
        from audiotokenizer import AudioTokenizerV2  # type: ignore

        return AudioTokenizerV2
    except ImportError:
        from yarngpt.audiotokenizer import AudioTokenizerV2  # type: ignore

        return AudioTokenizerV2


def build_yarngpt_synthesizer() -> Callable[[str, str, str], tuple[np.ndarray, int]]:
    """Load multilingual YarnGPT2b (AudioTokenizerV2) once onto GPU, with v1 fallback."""
    try:
        AudioTokenizerV2 = _import_audio_tokenizer_v2()
        import torch  # type: ignore
        from transformers import AutoModelForCausalLM  # type: ignore

        model_id = "saheedniyi/YarnGPT2b"
        wav_cfg, wav_ckpt = _find_wavtokenizer_paths()
        audio_tok = AudioTokenizerV2(model_id, wav_ckpt, wav_cfg)
        model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype="auto").to(audio_tok.device)

        def _synth(chunk: str, lang: str, voice: str) -> tuple[np.ndarray, int]:
            prompt = audio_tok.create_prompt(
                chunk,
                lang=YARNGPT_LANG_NAMES.get(lang, "english"),
                speaker_name=voice,
            )
            input_ids = audio_tok.tokenize_prompt(prompt)
            with torch.no_grad():
                output = model.generate(
                    input_ids=input_ids,
                    temperature=0.1,
                    repetition_penalty=1.1,
                    max_length=4000,
                )
            codes = audio_tok.get_codes(output)
            if not codes:
                return np.zeros(int(24000 * 0.25), dtype=np.float32), 24000
            audio = audio_tok.get_audio(codes)
            arr = audio.detach().cpu().numpy().squeeze() if hasattr(audio, "detach") else np.asarray(audio)
            return np.atleast_1d(arr).astype(np.float32), 24000

        return _synth
    except ImportError:
        from yarngpt import generate_speech  # type: ignore

        sig = inspect.signature(generate_speech)
        supports_lang = "language" in sig.parameters
        v1_speakers = {"idera", "jude", "joke", "umar", "osagie", "onye"}

        def _synth(chunk: str, lang: str, voice: str) -> tuple[np.ndarray, int]:
            kwargs: dict = {
                "speaker": voice if (supports_lang or voice in v1_speakers) else "idera",
                "temperature": 0.1,
            }
            if supports_lang:
                kwargs["language"] = YARNGPT_LANG_NAMES.get(lang, "english")
            audio = generate_speech(chunk, **kwargs)
            arr = audio.detach().cpu().numpy().squeeze() if hasattr(audio, "detach") else np.asarray(audio)
            return arr.astype(np.float32), 24000

        return _synth


def export_audio_file(
    samples: np.ndarray,
    sample_rate: int,
    target_dir: Path,
    base_name: str,
    use_ffmpeg: bool,
) -> Path:
    target_dir.mkdir(parents=True, exist_ok=True)
    normalized = normalize_waveform(samples)

    if use_ffmpeg and shutil.which("ffmpeg"):
        out_path = target_dir / f"{base_name}.ogg"
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            write_wav(tmp_path, normalized, sample_rate=sample_rate)
            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                str(tmp_path),
                "-ac",
                "1",
                "-c:a",
                "libopus",
                "-b:a",
                "28k",
                "-af",
                "loudnorm=I=-16:TP=-1.5:LRA=11",
                str(out_path),
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return out_path
        finally:
            tmp_path.unlink(missing_ok=True)

    out_path = target_dir / f"{base_name}.wav"
    if sample_rate > 8000 and len(normalized) > 16:
        step = max(1, sample_rate // 8000)
        downsampled = normalized[::step]
        write_wav(out_path, downsampled, sample_rate=sample_rate // step)
    else:
        write_wav(out_path, normalized, sample_rate=sample_rate)
    return out_path


def render_text_to_audio(
    text: str,
    lang: str,
    intent_key: str,
    kind: str,
    voice: str,
    take_idx: int,
    out_root: Path,
    demo_synth: bool,
    yarngpt_fn: Optional[Callable[[str, str, str], tuple[np.ndarray, int]]],
    use_ffmpeg: bool,
) -> tuple[str, Path]:
    chunks = split_into_chunks(text, max_words=25)
    digest = text_hash(text)
    take_suffix = f"_take{take_idx + 1}" if take_idx > 0 else ""
    base_name = f"{intent_key}_{kind}_{digest}{take_suffix}"

    sr = 16000 if demo_synth else 24000
    silence_len = int(sr * 0.25)

    joined: list[np.ndarray] = []
    for i, chunk in enumerate(chunks):
        if demo_synth:
            seg = synthesize_demo_chunk(chunk, lang, take_idx=take_idx, sample_rate=sr)
        else:
            assert yarngpt_fn is not None
            seg, sr = yarngpt_fn(chunk, lang, voice)
            silence_len = int(sr * 0.25)
        joined.append(seg)
        if i < len(chunks) - 1:
            joined.append(np.zeros(silence_len, dtype=np.float32))

    waveform = np.concatenate(joined) if joined else np.zeros(int(sr * 0.3), dtype=np.float32)
    out_file = export_audio_file(waveform, sr, out_root / lang, base_name, use_ffmpeg=use_ffmpeg)
    url = f"/static/audio/{lang}/{out_file.name}"
    return url, out_file


def render_text_via_api(
    client: YarnGPTAPIClient,
    catalogue: list[dict],
    text: str,
    lang: str,
    intent_key: str,
    kind: str,
    take_idx: int,
    out_root: Path,
    api_mode: str,
    output_format: str,
) -> tuple[str, Path, Optional[str]]:
    digest = text_hash(text)
    take_suffix = f"_take{take_idx + 1}" if take_idx > 0 else ""
    effective_format = "mp3" if (api_mode == "job" and output_format == "opus") else output_format
    ext = API_FORMAT_TO_EXT.get(effective_format, "ogg")
    base_name = f"{intent_key}_{kind}_{digest}{take_suffix}"
    target_dir = out_root / lang
    target_dir.mkdir(parents=True, exist_ok=True)
    out_file = target_dir / f"{base_name}.{ext}"

    voice_id = client.resolve_voice(lang, take_idx, catalogue)
    if api_mode == "job":
        audio_bytes = client.synthesize_job(
            text,
            voice=voice_id,
            output_format=effective_format,
            idempotency_key=f"hy-{base_name}",
        )
    else:
        audio_bytes = client.synthesize_prepare(
            text,
            voice=voice_id,
            output_format=effective_format,
        )

    out_file.write_bytes(audio_bytes)
    url = f"/static/audio/{lang}/{out_file.name}"
    return url, out_file, voice_id


def _target_exists_for_digest(
    existing_url: Optional[str],
    digest: str,
    out_root: Path,
    lang: str,
    expected_ext: Optional[str],
) -> bool:
    if not existing_url or digest not in existing_url:
        return False
    if expected_ext and not existing_url.endswith(f".{expected_ext}"):
        return False
    filename = existing_url.rsplit("/", 1)[-1]
    return (out_root / lang / filename).exists()


def run_generation(
    session: Session,
    out_root: Path,
    only_missing: bool = False,
    lang_filter: Optional[str] = None,
    takes: int = 1,
    demo_synth: bool = False,
    use_api: bool = False,
    api_mode: str = "prepare",
    output_format: str = "opus",
    api_client: Optional[YarnGPTAPIClient] = None,
    use_spitch: bool = False,
    spitch_client: Optional[SpitchTTSClient] = None,
) -> dict:
    has_ffmpeg = bool(shutil.which("ffmpeg"))
    yarngpt_fn = None
    catalogue: list[dict] = []
    owns_client = False

    if use_spitch:
        if spitch_client is None:
            settings = get_settings()
            spitch_client = SpitchTTSClient(api_key=settings.SPITCH_API_KEY)
        expected_ext: Optional[str] = "ogg"
    elif use_api:
        if api_client is None:
            settings = get_settings()
            api_client = YarnGPTAPIClient(
                api_key=settings.YARNGPT_API_KEY,
                base_url=settings.YARNGPT_BASE_URL,
            )
            owns_client = True
        catalogue = api_client.list_voices()
        effective_format = "mp3" if (api_mode == "job" and output_format == "opus") else output_format
        expected_ext = API_FORMAT_TO_EXT.get(effective_format, "ogg")
    elif not demo_synth:
        yarngpt_fn = build_yarngpt_synthesizer()
        expected_ext = "ogg" if has_ffmpeg else "wav"
    else:
        expected_ext = "ogg" if has_ffmpeg else "wav"

    created_files: list[Path] = []

    try:
        faqs = {f.id: f for f in session.exec(select(FAQItem)).all()}
        tr_query = select(Translation)
        if lang_filter:
            tr_query = tr_query.where(Translation.lang == lang_filter)
        translations = session.exec(tr_query).all()

        total_trs = len(translations)
        for idx, tr in enumerate(translations, start=1):
            faq = faqs.get(tr.faq_id)
            if not faq:
                continue
            if use_spitch:
                voices = SPITCH_VOICE_MAP.get(tr.lang, ["remi"])
            elif use_api or demo_synth:
                voices = DEFAULT_VOICE_MAP.get(tr.lang, ["idera"])
            else:
                voices = LOCAL_GPU_VOICE_MAP.get(tr.lang, ["idera"])

            if not demo_synth:
                print(f"[{idx}/{total_trs}] {faq.intent_key} ({tr.lang})", flush=True)

            # Question audio
            q_digest = text_hash(tr.question_text)
            needs_q = (
                not only_missing
                or tr.regen_requested
                or not _target_exists_for_digest(
                    tr.question_audio_url, q_digest, out_root, tr.lang, expected_ext
                )
            )
            if needs_q:
                if use_spitch:
                    assert spitch_client is not None
                    q_url, q_path = render_text_via_spitch(
                        spitch_client,
                        tr.question_text,
                        tr.lang,
                        faq.intent_key,
                        "question",
                        voices[0],
                        0,
                        out_root,
                        reuse_existing=only_missing and not tr.regen_requested,
                    )
                elif use_api:
                    assert api_client is not None
                    q_url, q_path, _ = render_text_via_api(
                        api_client,
                        catalogue,
                        tr.question_text,
                        tr.lang,
                        faq.intent_key,
                        "question",
                        0,
                        out_root,
                        api_mode,
                        output_format,
                    )
                else:
                    q_url, q_path = render_text_to_audio(
                        tr.question_text,
                        tr.lang,
                        faq.intent_key,
                        "question",
                        voices[0],
                        0,
                        out_root,
                        demo_synth,
                        yarngpt_fn,
                        has_ffmpeg,
                    )
                tr.question_audio_url = q_url
                tr.updated_at = utc_now()
                session.add(tr)
                session.commit()
                created_files.append(q_path)

            # Answer audio (supports multiple takes)
            a_digest = text_hash(tr.answer_text)
            needs_a = (
                not only_missing
                or tr.regen_requested
                or not _target_exists_for_digest(
                    tr.answer_audio_url, a_digest, out_root, tr.lang, expected_ext
                )
            )
            if needs_a:
                take_urls: list[str] = []
                used_voice: Optional[str] = voices[0]
                for t_idx in range(max(1, takes)):
                    if use_spitch:
                        assert spitch_client is not None
                        voice = voices[t_idx % len(voices)]
                        a_url, a_path = render_text_via_spitch(
                            spitch_client,
                            tr.answer_text,
                            tr.lang,
                            faq.intent_key,
                            "answer",
                            voice,
                            t_idx,
                            out_root,
                            reuse_existing=only_missing and not tr.regen_requested,
                        )
                        if t_idx == 0:
                            used_voice = voice
                    elif use_api:
                        assert api_client is not None
                        a_url, a_path, resolved_v = render_text_via_api(
                            api_client,
                            catalogue,
                            tr.answer_text,
                            tr.lang,
                            faq.intent_key,
                            "answer",
                            t_idx,
                            out_root,
                            api_mode,
                            output_format,
                        )
                        if t_idx == 0:
                            used_voice = resolved_v or "api-default"
                    else:
                        voice = voices[t_idx % len(voices)]
                        a_url, a_path = render_text_to_audio(
                            tr.answer_text,
                            tr.lang,
                            faq.intent_key,
                            "answer",
                            voice,
                            t_idx,
                            out_root,
                            demo_synth,
                            yarngpt_fn,
                            has_ffmpeg,
                        )
                        if t_idx == 0:
                            used_voice = voice
                    take_urls.append(a_url)
                    created_files.append(a_path)
                tr.answer_audio_url = take_urls[0]
                tr.audio_takes_json = json.dumps(take_urls)
                tr.voice_name = used_voice
                tr.regen_requested = False
                tr.updated_at = utc_now()
                session.add(tr)
                session.commit()

        # System messages
        msg_query = select(SystemMessage)
        if lang_filter:
            msg_query = msg_query.where(SystemMessage.lang == lang_filter)
        sys_msgs = session.exec(msg_query).all()
        for idx, msg in enumerate(sys_msgs, start=1):
            if use_spitch:
                voices = SPITCH_VOICE_MAP.get(msg.lang, ["remi"])
            elif use_api or demo_synth:
                voices = DEFAULT_VOICE_MAP.get(msg.lang, ["idera"])
            else:
                voices = LOCAL_GPU_VOICE_MAP.get(msg.lang, ["idera"])

            m_digest = text_hash(msg.text)
            needs_m = not only_missing or not _target_exists_for_digest(
                msg.audio_url, m_digest, out_root, msg.lang, expected_ext
            )
            if needs_m:
                if use_spitch:
                    assert spitch_client is not None
                    print(f"[sys {idx}/{len(sys_msgs)}] {msg.key} ({msg.lang})", flush=True)
                    m_url, m_path = render_text_via_spitch(
                        spitch_client,
                        msg.text,
                        msg.lang,
                        f"sys_{msg.key}",
                        "prompt",
                        voices[0],
                        0,
                        out_root,
                        reuse_existing=only_missing,
                    )
                elif use_api:
                    assert api_client is not None
                    m_url, m_path, _ = render_text_via_api(
                        api_client,
                        catalogue,
                        msg.text,
                        msg.lang,
                        f"sys_{msg.key}",
                        "prompt",
                        0,
                        out_root,
                        api_mode,
                        output_format,
                    )
                else:
                    m_url, m_path = render_text_to_audio(
                        msg.text,
                        msg.lang,
                        f"sys_{msg.key}",
                        "prompt",
                        voices[0],
                        0,
                        out_root,
                        demo_synth,
                        yarngpt_fn,
                        has_ffmpeg,
                    )
                msg.audio_url = m_url
                session.add(msg)
                session.commit()
                created_files.append(m_path)

        session.commit()
    finally:
        if owns_client and api_client is not None:
            api_client.close()

    total_bytes = sum(p.stat().st_size for p in created_files if p.exists())
    count = len(created_files)
    avg_kb = (total_bytes / count / 1024.0) if count else 0.0
    mode_label = (
        "spitch"
        if use_spitch
        else ("api" if use_api else ("demo_synth" if demo_synth else "local_gpu"))
    )
    return {
        "files_created": count,
        "total_kb": round(total_bytes / 1024.0, 2),
        "average_kb": round(avg_kb, 2),
        "mode": mode_label,
        "format": expected_ext,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch-generate audio clips with Spitch TTS, YarnGPT API, local/Colab GPU, or --demo-synth."
    )
    parser.add_argument("--only-missing", action="store_true", help="Skip items whose hashed target audio already exists.")
    parser.add_argument("--lang", choices=["en", "yo", "pcm"], default=None, help="Filter to a single language.")
    parser.add_argument("--takes", type=int, default=1, help="Number of voice takes per answer.")
    parser.add_argument(
        "--spitch",
        action="store_true",
        help="Synthesise Opus .ogg clips using Spitch TTS (requires SPITCH_API_KEY).",
    )
    parser.add_argument(
        "--api",
        action="store_true",
        help="Synthesise using the hosted YarnGPT REST API (requires YARNGPT_API_KEY).",
    )
    parser.add_argument(
        "--api-mode",
        choices=["prepare", "job"],
        default="prepare",
        help="YarnGPT API flow: 'prepare' (streaming ticket, supports opus) or 'job' (async polling, mp3/wav).",
    )
    parser.add_argument(
        "--format",
        choices=["opus", "mp3", "wav"],
        default="opus",
        help="Output audio format for --api mode (default: opus -> .ogg).",
    )
    parser.add_argument(
        "--list-voices",
        action="store_true",
        help="Fetch and print the live voice catalogue from GET /api/v1/voices, then exit.",
    )
    parser.add_argument(
        "--demo-synth",
        action="store_true",
        help="Synthesise local playable demo audio clips without API or GPU.",
    )
    args = parser.parse_args()

    settings = get_settings()

    if args.list_voices:
        client = YarnGPTAPIClient(api_key=settings.YARNGPT_API_KEY, base_url=settings.YARNGPT_BASE_URL)
        try:
            voices = client.list_voices()
            print(json.dumps(voices, indent=2, ensure_ascii=False))
        finally:
            client.close()
        return

    use_spitch = args.spitch or (
        not args.demo_synth
        and not args.api
        and bool(settings.SPITCH_API_KEY and settings.SPITCH_API_KEY != "TODO")
        and not (settings.YARNGPT_API_KEY and settings.YARNGPT_API_KEY != "TODO")
    )
    use_api = args.api or (
        not args.demo_synth
        and not use_spitch
        and bool(settings.YARNGPT_API_KEY and settings.YARNGPT_API_KEY != "TODO")
    )
    if args.demo_synth:
        use_spitch = False
        use_api = False

    init_db(engine)
    try:
        with Session(engine) as session:
            summary = run_generation(
                session,
                out_root=settings.static_audio_dir,
                only_missing=args.only_missing,
                lang_filter=args.lang,
                takes=args.takes,
                demo_synth=args.demo_synth,
                use_api=use_api,
                api_mode=args.api_mode,
                output_format=args.format,
                use_spitch=use_spitch,
            )
    except (YarnGPTAPIError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Audio generation complete: {summary}")


if __name__ == "__main__":
    main()
