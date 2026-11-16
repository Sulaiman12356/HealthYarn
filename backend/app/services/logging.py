"""Anonymous query logging with NDPA 2023 data minimisation guarantees."""

from __future__ import annotations

from typing import Optional

from sqlmodel import Session

from app.models import QueryLog


def record_query_log(
    session: Session,
    *,
    lang: str,
    input_mode: str,
    outcome: str,
    matched_faq_id: Optional[int] = None,
    confidence: Optional[float] = None,
    transcript: Optional[str] = None,
    log_unmatched_text: bool = False,
) -> QueryLog:
    """Persist one anonymous query log row. Never stores audio, IPs, or device IDs."""
    stored_text: Optional[str] = None
    if outcome == "unsure" and log_unmatched_text and transcript:
        stored_text = transcript[:300]

    row = QueryLog(
        lang=lang,
        input_mode=input_mode,
        matched_faq_id=matched_faq_id,
        confidence=confidence,
        outcome=outcome,
        unmatched_text=stored_text,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
