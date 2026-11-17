"""Generate Spitch TTS .ogg clips for all 9 /about sections across en, pcm, and yo."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.config import get_settings
from scripts.generate_audio import (
    DEFAULT_VOICE_MAP,
    SPITCH_VOICE_MAP,
    SpitchTTSClient,
    YarnGPTAPIClient,
    YarnGPTAPIError,
)


def build_section_scripts(i18n: dict[str, str], about_cfg: dict) -> dict[int, str]:
    stt = (about_cfg.get("sttProvider") or "").strip()
    inst = (about_cfg.get("institution") or "").strip()
    stt_part = f" {i18n['aboutSec6SttTemplate'].format(stt=stt)}" if stt else ""
    inst_part = f" {i18n['aboutSec5InstitutionTemplate'].format(institution=inst)}" if inst else ""

    return {
        1: f"{i18n['aboutSec1Title']}. {i18n['aboutSec1Lead']}",
        2: f"{i18n['aboutSec2Title']}. {i18n['aboutSec2Body']} {i18n['aboutSec2Quote']}",
        3: (
            f"{i18n['aboutSec3Title']} "
            f"1. {i18n['aboutSec3Step1']}. "
            f"2. {i18n['aboutSec3Step2']}. "
            f"3. {i18n['aboutSec3Step3']}. "
            f"4. {i18n['aboutSec3Step4']} "
            f"{i18n['aboutSec3Note']}"
        ),
        4: (
            f"{i18n['aboutSec4Title']}. "
            f"{i18n['aboutSec4WillTitle']}: "
            f"{i18n['aboutSec4Will1']}, {i18n['aboutSec4Will2']}, "
            f"{i18n['aboutSec4Will3']}, {i18n['aboutSec4Will4']} "
            f"{i18n['aboutSec4WontTitle']}: "
            f"{i18n['aboutSec4Wont1']}, {i18n['aboutSec4Wont2']}, "
            f"{i18n['aboutSec4Wont3']}, {i18n['aboutSec4Wont4']} "
            f"{i18n['aboutSec4Emergency']}"
        ),
        5: f"{i18n['aboutSec5Title']}.{inst_part}".strip(),
        6: f"{i18n['aboutSec6Title']}. {i18n['aboutSec6Voices']}{stt_part} {i18n['aboutSec6Rest']}",
        7: (
            f"{i18n['aboutSec7Title']}. "
            f"{i18n['aboutSec7Point1']}. {i18n['aboutSec7Point2']}. {i18n['aboutSec7Point3']}"
        ),
        8: f"{i18n['aboutSec8Title']}. {i18n['aboutSec8Body']}",
        9: i18n["aboutSec9Title"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Spitch TTS audio clips for /about sections.")
    parser.add_argument("--only-missing", action="store_true", help="Skip clips already present.")
    args = parser.parse_args()

    settings = get_settings()
    repo_root = Path(__file__).resolve().parents[2]
    i18n_dir = repo_root / "frontend" / "src" / "i18n"
    about_cfg_path = repo_root / "frontend" / "src" / "config" / "about.config.json"
    about_cfg = json.loads(about_cfg_path.read_text(encoding="utf-8"))

    client: SpitchTTSClient | None = None
    if settings.SPITCH_API_KEY and settings.SPITCH_API_KEY != "TODO":
        client = SpitchTTSClient(api_key=settings.SPITCH_API_KEY)
    yarngpt_client: YarnGPTAPIClient | None = None
    yarngpt_catalogue: list[dict] = []
    created = 0
    skipped = 0
    total_bytes = 0

    try:
        for lang in ("en", "pcm", "yo"):
            i18n = json.loads((i18n_dir / f"{lang}.json").read_text(encoding="utf-8"))
            voice = SPITCH_VOICE_MAP[lang][0]
            sections = build_section_scripts(i18n, about_cfg)
            out_dir = settings.static_audio_dir / "about" / lang
            out_dir.mkdir(parents=True, exist_ok=True)

            for sec_id, text in sections.items():
                out_file = out_dir / f"section_{sec_id}.ogg"
                if args.only_missing and out_file.exists() and out_file.stat().st_size > 64:
                    skipped += 1
                    total_bytes += out_file.stat().st_size
                    continue

                audio_bytes: bytes | None = None
                if client is not None:
                    try:
                        print(f"[about {lang}] section_{sec_id} via Spitch ({voice})...", flush=True)
                        audio_bytes = client.synthesize(text, lang=lang, voice=voice)
                    except YarnGPTAPIError as exc:
                        print(f"Spitch unavailable ({exc}); switching to YarnGPT fallback...", flush=True)
                        client = None

                if audio_bytes is None:
                    if not settings.YARNGPT_API_KEY or settings.YARNGPT_API_KEY == "TODO":
                        raise RuntimeError("Neither Spitch credits nor YARNGPT_API_KEY available.")
                    if yarngpt_client is None:
                        yarngpt_client = YarnGPTAPIClient(
                            api_key=settings.YARNGPT_API_KEY,
                            base_url=settings.YARNGPT_BASE_URL,
                        )
                        yarngpt_catalogue = yarngpt_client.list_voices()
                    yg_voice = yarngpt_client.resolve_voice(lang, 0, yarngpt_catalogue)
                    print(
                        f"[about {lang}] section_{sec_id} via YarnGPT ({yg_voice or DEFAULT_VOICE_MAP[lang][0]})...",
                        flush=True,
                    )
                    audio_bytes = yarngpt_client.synthesize_prepare(
                        text,
                        voice=yg_voice,
                        output_format="opus",
                    )

                out_file.write_bytes(audio_bytes)
                created += 1
                total_bytes += len(audio_bytes)
    finally:
        if yarngpt_client is not None:
            yarngpt_client.close()

    print(
        f"About audio complete: created={created}, skipped={skipped}, total_kb={round(total_bytes / 1024, 2)}"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
