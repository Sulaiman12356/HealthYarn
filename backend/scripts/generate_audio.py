"""Offline batch audio synthesis pipeline for HealthYarn (YarnGPT + ffmpeg Opus).

Usage:
  python -m scripts.generate_audio --only-missing
  python -m scripts.generate_audio --lang yo --takes 2
  python -m scripts.generate_audio --demo-synth
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Callable, Optional

import numpy as np
from sqlmodel import Session, select

from app.config import get_settings
from app.db import engine, init_db
from app.models import PLACEHOLDER_PREFIX, FAQItem, SystemMessage, Translation, utc_now

# Verified speaker names for saheedniyi/YarnGPT2b / yarngpt PyPI package
DEFAULT_VOICE_MAP: dict[str, list[str]] = {
    "yo": ["folake", "aisha", "abayomi"],
    "ig": ["chioma", "adanna", "obinna"],
    "en": ["idera", "emma", "jude"],
}

YARNGPT_LANG_NAMES: dict[str, str] = {
    "yo": "yoruba",
    "ig": "igbo",
    "en": "english",
}


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
    base_freq = {"yo": 220.0, "ig": 246.94, "en": 196.0}.get(lang, 220.0)
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


def build_yarngpt_synthesizer() -> Callable[[str, str, str], tuple[np.ndarray, int]]:
    """Load YarnGPT model (saheedniyi/YarnGPT2b or yarngpt package) for GPU inference."""
    try:
        from yarngpt import generate_speech  # type: ignore

        def _synth(chunk: str, lang: str, voice: str) -> tuple[np.ndarray, int]:
            audio = generate_speech(
                chunk,
                speaker=voice,
                language=YARNGPT_LANG_NAMES.get(lang, "english"),
                temperature=0.1,
            )
            arr = audio.detach().cpu().numpy().squeeze() if hasattr(audio, "detach") else np.asarray(audio)
            return arr.astype(np.float32), 24000

        return _synth
    except ImportError:
        import torch  # type: ignore
        from transformers import AutoModelForCausalLM  # type: ignore
        from yarngpt.audiotokenizer import AudioTokenizerV2  # type: ignore

        model_id = "saheedniyi/YarnGPT2b"
        wav_cfg = "wavtokenizer_mediumdata_frame75_3s_nq1_code4096_dim512_kmeans200_attn.yaml"
        wav_ckpt = "wavtokenizer_large_speech_320_24k.ckpt"
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
            audio = audio_tok.get_audio(codes)
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

    # Local no-ffmpeg fallback: write compact 8 kHz mono PCM WAV (< 40 KB)
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

    silence_samples = 0
    sr = 16000 if demo_synth else 24000
    silence_len = int(sr * 0.25)  # 250 ms inter-sentence silence

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
            silence_samples += silence_len

    waveform = np.concatenate(joined) if joined else np.zeros(int(sr * 0.3), dtype=np.float32)
    out_file = export_audio_file(waveform, sr, out_root / lang, base_name, use_ffmpeg=use_ffmpeg)
    url = f"/static/audio/{lang}/{out_file.name}"
    return url, out_file


def run_generation(
    session: Session,
    out_root: Path,
    only_missing: bool = False,
    lang_filter: Optional[str] = None,
    takes: int = 1,
    demo_synth: bool = False,
) -> dict:
    has_ffmpeg = bool(shutil.which("ffmpeg"))
    yarngpt_fn = None if demo_synth else build_yarngpt_synthesizer()

    created_files: list[Path] = []

    faqs = {f.id: f for f in session.exec(select(FAQItem)).all()}
    tr_query = select(Translation)
    if lang_filter:
        tr_query = tr_query.where(Translation.lang == lang_filter)
    translations = session.exec(tr_query).all()

    for tr in translations:
        faq = faqs.get(tr.faq_id)
        if not faq:
            continue
        voices = DEFAULT_VOICE_MAP.get(tr.lang, ["idera"])

        # Question audio
        q_digest = text_hash(tr.question_text)
        needs_q = (
            not only_missing
            or not tr.question_audio_url
            or q_digest not in tr.question_audio_url
            or tr.regen_requested
        )
        if needs_q:
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
            created_files.append(q_path)

        # Answer audio (supports multiple takes for language reviewer selection)
        a_digest = text_hash(tr.answer_text)
        needs_a = (
            not only_missing
            or not tr.answer_audio_url
            or a_digest not in tr.answer_audio_url
            or tr.regen_requested
        )
        if needs_a:
            take_urls: list[str] = []
            for t_idx in range(max(1, takes)):
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
                take_urls.append(a_url)
                created_files.append(a_path)
            tr.answer_audio_url = take_urls[0]
            tr.audio_takes_json = json.dumps(take_urls)
            tr.voice_name = voices[0]
            tr.regen_requested = False
            tr.updated_at = utc_now()
            session.add(tr)

    # System messages
    msg_query = select(SystemMessage)
    if lang_filter:
        msg_query = msg_query.where(SystemMessage.lang == lang_filter)
    sys_msgs = session.exec(msg_query).all()
    for msg in sys_msgs:
        voices = DEFAULT_VOICE_MAP.get(msg.lang, ["idera"])
        m_digest = text_hash(msg.text)
        needs_m = not only_missing or not msg.audio_url or m_digest not in msg.audio_url
        if needs_m:
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
            created_files.append(m_path)

    session.commit()

    total_bytes = sum(p.stat().st_size for p in created_files if p.exists())
    count = len(created_files)
    avg_kb = (total_bytes / count / 1024.0) if count else 0.0
    summary = {
        "files_created": count,
        "total_kb": round(total_bytes / 1024.0, 2),
        "average_kb": round(avg_kb, 2),
        "ffmpeg_opus": has_ffmpeg,
        "demo_synth": demo_synth,
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch-generate audio clips with YarnGPT (or --demo-synth).")
    parser.add_argument("--only-missing", action="store_true", help="Skip items whose hashed audio already exists.")
    parser.add_argument("--lang", choices=["en", "yo", "ig"], default=None, help="Filter to a single language.")
    parser.add_argument("--takes", type=int, default=1, help="Number of voice takes per answer.")
    parser.add_argument(
        "--demo-synth",
        action="store_true",
        help="Synthesise local playable demo audio clips without GPU/YarnGPT.",
    )
    args = parser.parse_args()

    settings = get_settings()
    init_db(engine)
    with Session(engine) as session:
        summary = run_generation(
            session,
            out_root=settings.static_audio_dir,
            only_missing=args.only_missing,
            lang_filter=args.lang,
            takes=args.takes,
            demo_synth=args.demo_synth,
        )
    print(f"Audio generation complete: {summary}")


if __name__ == "__main__":
    main()
