"""Text normalization and pre-matching red-flag safety rule engine."""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from sqlmodel import Session, select

from app.models import RedFlagRule


def strip_diacritics(text: str) -> str:
    """Decompose Unicode via NFD and strip combining marks (Yorùbá/Igbo tone & sub-dots)."""
    nfd = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def normalize_text(text: str) -> tuple[str, str]:
    """Return (lowercased_collapsed, ascii_folded_diacritic_stripped)."""
    cleaned = re.sub(r"\s+", " ", text.strip().lower())
    folded = re.sub(r"\s+", " ", strip_diacritics(cleaned))
    return cleaned, folded


def check_red_flags(session: Session, text: str, lang: str) -> Optional[RedFlagRule]:
    """Evaluate published red-flag rules for both target language and English.

    Always runs before FAQ matching. Returns the first matched rule or None.
    """
    cleaned, folded = normalize_text(text)
    if not cleaned:
        return None

    langs = {lang.lower(), "en"}
    rules = session.exec(
        select(RedFlagRule).where(
            RedFlagRule.status == "published",
            RedFlagRule.lang.in_(langs),  # type: ignore[attr-defined]
        )
    ).all()

    for rule in rules:
        try:
            pattern = re.compile(rule.pattern, flags=re.IGNORECASE)
        except re.error:
            continue
        if pattern.search(cleaned) or pattern.search(folded):
            return rule
    return None
