"""Public read-only & feedback API endpoints for HealthYarn."""

from __future__ import annotations

import hashlib
import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_session
from app.models import (
    AppMeta,
    Clinic,
    FAQItem,
    QueryLog,
    SystemMessage,
    Topic,
    Translation,
)

router = APIRouter(prefix="/api", tags=["public"])

SUPPORTED_LANGS = {"en", "yo", "ig"}


def validate_lang(lang: str) -> str:
    cleaned = lang.strip().lower()
    if cleaned not in SUPPORTED_LANGS:
        raise HTTPException(status_code=400, detail="Unsupported language. Use 'en', 'yo', or 'ig'.")
    return cleaned


def get_meta_dict(session: Session) -> dict[str, str]:
    rows = session.exec(select(AppMeta)).all()
    return {r.key: r.value for r in rows}


def is_demo_mode(session: Session) -> bool:
    meta = get_meta_dict(session)
    if "demo_mode" in meta:
        return meta["demo_mode"].lower() == "true"
    return get_settings().DEMO_MODE


def _topic_name(topic: Topic, lang: str) -> str:
    return getattr(topic, f"name_{lang}", "") or topic.name_en or topic.slug


def _topic_desc(topic: Topic, lang: str) -> str:
    return getattr(topic, f"desc_{lang}", "") or topic.desc_en or ""


class FeedbackRequest(BaseModel):
    log_id: Optional[int] = None
    faq_id: Optional[int] = None
    lang: Optional[Literal["en", "yo", "ig"]] = None
    rating: Literal[1, -1]


class AskTextRequest(BaseModel):
    text: str = PydanticField(min_length=1, max_length=1000)
    lang: Literal["en", "yo", "ig"] = "en"


@router.get("/meta")
def read_meta(session: Session = Depends(get_session)) -> dict:
    meta = get_meta_dict(session)
    sys_msgs = session.exec(
        select(SystemMessage).where(
            SystemMessage.status == "published",
            SystemMessage.key.in_(["welcome", "consent"]),  # type: ignore[attr-defined]
        )
    ).all()
    welcome_audio: dict[str, str | None] = {}
    consent_audio: dict[str, str | None] = {}
    for m in sys_msgs:
        if m.key == "welcome":
            welcome_audio[m.lang] = m.audio_url
        elif m.key == "consent":
            consent_audio[m.lang] = m.audio_url
    return {
        "demo_mode": is_demo_mode(session),
        "content_last_updated": meta.get("content_last_updated", ""),
        "clinical_reviewers": meta.get("clinical_reviewers", "Clinical Review Board"),
        "language_reviewers": meta.get("language_reviewers", "Yorùbá & Igbo Review Team"),
        "welcome_audio": welcome_audio,
        "consent_audio": consent_audio,
    }


@router.get("/topics")
def list_topics(
    lang: str = Query(default="en"),
    session: Session = Depends(get_session),
) -> dict:
    lang = validate_lang(lang)
    topics = session.exec(select(Topic).order_by(Topic.sort_order)).all()
    faqs = session.exec(select(FAQItem).where(FAQItem.is_active == True)).all()  # noqa: E712
    faq_by_id = {f.id: f for f in faqs}

    translations = session.exec(
        select(Translation).where(Translation.lang == lang, Translation.status == "published")
    ).all()

    questions_by_topic: dict[int, list[dict]] = {}
    for tr in translations:
        faq = faq_by_id.get(tr.faq_id)
        if not faq:
            continue
        questions_by_topic.setdefault(faq.topic_id, []).append(
            {
                "faq_id": faq.id,
                "intent_key": faq.intent_key,
                "question": tr.question_text,
                "question_audio_url": tr.question_audio_url,
            }
        )

    result_topics = []
    for t in topics:
        qs = sorted(questions_by_topic.get(t.id, []), key=lambda q: q["faq_id"])
        result_topics.append(
            {
                "id": t.id,
                "slug": t.slug,
                "icon": t.icon,
                "sort_order": t.sort_order,
                "name": _topic_name(t, lang),
                "description": _topic_desc(t, lang),
                "questions": qs,
            }
        )

    return {
        "lang": lang,
        "demo_mode": is_demo_mode(session),
        "topics": result_topics,
    }


@router.get("/answers/{faq_id}")
def get_answer(
    faq_id: int,
    lang: str = Query(default="en"),
    record_tap: bool = Query(default=True),
    session: Session = Depends(get_session),
) -> dict:
    lang = validate_lang(lang)
    faq = session.get(FAQItem, faq_id)
    if not faq or not faq.is_active:
        raise HTTPException(status_code=404, detail="FAQ item not found")

    tr = session.exec(
        select(Translation).where(
            Translation.faq_id == faq_id,
            Translation.lang == lang,
            Translation.status == "published",
        )
    ).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Published answer not found for this language")

    topic = session.get(Topic, faq.topic_id)
    disclaimer = session.exec(
        select(SystemMessage).where(
            SystemMessage.key == "disclaimer",
            SystemMessage.lang == lang,
            SystemMessage.status == "published",
        )
    ).first()

    log_id: Optional[int] = None
    if record_tap:
        log = QueryLog(
            lang=lang,
            input_mode="tap",
            matched_faq_id=faq.id,
            confidence=1.0,
            outcome="answer",
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        log_id = log.id

    return {
        "faq_id": faq.id,
        "intent_key": faq.intent_key,
        "topic_slug": topic.slug if topic else "",
        "topic_name": _topic_name(topic, lang) if topic else "",
        "lang": lang,
        "question": tr.question_text,
        "answer_text": tr.answer_text,
        "question_audio_url": tr.question_audio_url,
        "answer_audio_url": tr.answer_audio_url,
        "source_reference": faq.source_reference,
        "disclaimer_text": disclaimer.text if disclaimer else "",
        "disclaimer_audio_url": disclaimer.audio_url if disclaimer else None,
        "demo_mode": is_demo_mode(session),
        "log_id": log_id,
    }


@router.get("/bundle")
def get_offline_bundle(
    lang: str = Query(default="en"),
    session: Session = Depends(get_session),
) -> dict:
    lang = validate_lang(lang)
    topics = session.exec(select(Topic).order_by(Topic.sort_order)).all()
    faqs = session.exec(select(FAQItem).where(FAQItem.is_active == True)).all()  # noqa: E712
    faq_by_id = {f.id: f for f in faqs}

    translations = session.exec(
        select(Translation).where(Translation.lang == lang, Translation.status == "published")
    ).all()

    items_by_topic: dict[int, list[dict]] = {}
    audio_urls: set[str] = set()

    for tr in translations:
        faq = faq_by_id.get(tr.faq_id)
        if not faq:
            continue
        if tr.question_audio_url:
            audio_urls.add(tr.question_audio_url)
        if tr.answer_audio_url:
            audio_urls.add(tr.answer_audio_url)
        items_by_topic.setdefault(faq.topic_id, []).append(
            {
                "faq_id": faq.id,
                "intent_key": faq.intent_key,
                "source_reference": faq.source_reference,
                "question": tr.question_text,
                "answer_text": tr.answer_text,
                "question_audio_url": tr.question_audio_url,
                "answer_audio_url": tr.answer_audio_url,
            }
        )

    bundle_topics = []
    for t in topics:
        qs = sorted(items_by_topic.get(t.id, []), key=lambda q: q["faq_id"])
        bundle_topics.append(
            {
                "id": t.id,
                "slug": t.slug,
                "icon": t.icon,
                "sort_order": t.sort_order,
                "name": _topic_name(t, lang),
                "description": _topic_desc(t, lang),
                "items": qs,
            }
        )

    sys_msgs = session.exec(
        select(SystemMessage).where(SystemMessage.lang == lang, SystemMessage.status == "published")
    ).all()
    system_messages: dict[str, dict] = {}
    for m in sys_msgs:
        if m.audio_url:
            audio_urls.add(m.audio_url)
        system_messages[m.key] = {
            "text": m.text,
            "audio_url": m.audio_url,
        }

    clinics = session.exec(select(Clinic).order_by(Clinic.state, Clinic.name)).all()
    clinic_list = [
        {
            "id": c.id,
            "name": c.name,
            "lga": c.lga,
            "state": c.state,
            "phone": c.phone,
            "type": c.type,
            "lat": c.lat,
            "lng": c.lng,
        }
        for c in clinics
    ]

    meta = get_meta_dict(session)
    demo = is_demo_mode(session)
    payload_for_hash = {
        "lang": lang,
        "demo_mode": demo,
        "topics": bundle_topics,
        "system_messages": system_messages,
        "clinics": clinic_list,
    }
    version_hash = hashlib.sha256(
        json.dumps(payload_for_hash, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:16]

    return {
        "lang": lang,
        "version_hash": version_hash,
        "demo_mode": demo,
        "meta": {
            "content_last_updated": meta.get("content_last_updated", ""),
            "clinical_reviewers": meta.get("clinical_reviewers", "Clinical Review Board"),
            "language_reviewers": meta.get("language_reviewers", "Yorùbá & Igbo Review Team"),
        },
        "topics": bundle_topics,
        "system_messages": system_messages,
        "clinics": clinic_list,
        "audio_urls": sorted(audio_urls),
    }


@router.get("/clinics")
def list_clinics(
    state: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> dict:
    clinics = session.exec(select(Clinic).order_by(Clinic.state, Clinic.name)).all()
    if state:
        s_lower = state.strip().lower()
        clinics = [c for c in clinics if c.state.lower() == s_lower]
    return {
        "clinics": [
            {
                "id": c.id,
                "name": c.name,
                "lga": c.lga,
                "state": c.state,
                "phone": c.phone,
                "type": c.type,
                "lat": c.lat,
                "lng": c.lng,
            }
            for c in clinics
        ]
    }


@router.post("/feedback", status_code=status.HTTP_204_NO_CONTENT)
def submit_feedback(
    body: FeedbackRequest,
    session: Session = Depends(get_session),
) -> Response:
    if body.log_id is not None:
        log = session.get(QueryLog, body.log_id)
        if not log:
            raise HTTPException(status_code=404, detail="Query log not found")
        log.rating = body.rating
        session.add(log)
        session.commit()
    elif body.faq_id is not None:
        log = QueryLog(
            lang=body.lang or "en",
            input_mode="tap",
            matched_faq_id=body.faq_id,
            confidence=1.0,
            outcome="answer",
            rating=body.rating,
        )
        session.add(log)
        session.commit()
    else:
        raise HTTPException(status_code=400, detail="Provide log_id or faq_id")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
