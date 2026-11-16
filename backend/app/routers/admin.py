"""Authenticated staff portal API routes (/api/admin/*) with RBAC, CSRF, and audit logging."""

from __future__ import annotations

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Session, select

from app.auth import (
    clear_auth_cookies,
    create_access_token,
    get_current_user,
    hash_password,
    record_audit,
    require_role,
    set_auth_cookies,
    verify_password,
)
from app.config import get_settings
from app.db import get_session
from app.models import (
    PLACEHOLDER_PREFIX,
    AuditLog,
    Clinic,
    FAQItem,
    QueryLog,
    RedFlagRule,
    SampleQuestion,
    Topic,
    Translation,
    User,
    utc_now,
)
from app.services.limiter import limiter
from app.services.matcher import FAQMatcher

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _has_placeholder(tr: Translation) -> bool:
    return tr.question_text.strip().startswith(PLACEHOLDER_PREFIX) or tr.answer_text.strip().startswith(
        PLACEHOLDER_PREFIX
    )


def _refresh_matcher(request: Request, session: Session) -> None:
    matcher: Optional[FAQMatcher] = getattr(request.app.state, "matcher", None)
    if matcher is not None:
        matcher.build_index(session)


class LoginRequest(BaseModel):
    email: str
    password: str


class TranslationPayload(BaseModel):
    question_text: str = PydanticField(min_length=1)
    answer_text: str = PydanticField(min_length=1)
    samples: list[str] = []


class ItemCreateRequest(BaseModel):
    topic_id: int
    intent_key: str = PydanticField(min_length=2, max_length=120)
    source_reference: str = ""
    translations: dict[Literal["en", "yo", "pcm"], TranslationPayload]


class ItemUpdateRequest(BaseModel):
    source_reference: Optional[str] = None
    is_active: Optional[bool] = None
    translations: dict[Literal["en", "yo", "pcm"], TranslationPayload]


class ReviewActionRequest(BaseModel):
    approved: bool
    comment: Optional[str] = None
    selected_audio_url: Optional[str] = None


class CreateUserRequest(BaseModel):
    name: str = PydanticField(min_length=2, max_length=100)
    email: str = PydanticField(min_length=4, max_length=160)
    password: str = PydanticField(min_length=10, max_length=128)
    role: Literal["editor", "clinical_reviewer", "language_reviewer", "admin"]


class CreateClinicRequest(BaseModel):
    name: str = PydanticField(min_length=2)
    lga: str = PydanticField(min_length=2)
    state: str = PydanticField(min_length=2)
    phone: str = PydanticField(min_length=5)
    type: str = "Primary Health Centre"
    lat: Optional[float] = None
    lng: Optional[float] = None


@router.post("/login")
@limiter.limit("5/minute")
def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    session: Session = Depends(get_session),
) -> dict:
    email_clean = body.email.strip().lower()
    user = session.exec(select(User).where(User.email == email_clean, User.is_active == True)).first()  # noqa: E712
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(user)
    csrf_token = set_auth_cookies(response, token)
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
        "csrf_token": csrf_token,
    }


@router.post("/logout")
def logout(
    response: Response,
    _user: User = Depends(require_role("editor", "clinical_reviewer", "language_reviewer", "admin")),
) -> dict:
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
def read_me(response: Response, user: User = Depends(get_current_user)) -> dict:
    token = create_access_token(user)
    csrf_token = set_auth_cookies(response, token)
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
        "csrf_token": csrf_token,
    }


@router.get("/items")
def list_items(
    topic_slug: Optional[str] = Query(default=None),
    lang: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    topics = {t.id: t for t in session.exec(select(Topic).order_by(Topic.sort_order)).all()}
    faqs = session.exec(select(FAQItem).order_by(FAQItem.id)).all()
    all_trs = session.exec(select(Translation)).all()
    all_samples = session.exec(select(SampleQuestion)).all()

    trs_by_faq: dict[int, list[Translation]] = {}
    for tr in all_trs:
        trs_by_faq.setdefault(tr.faq_id, []).append(tr)

    samples_by_faq_lang: dict[tuple[int, str], list[str]] = {}
    for s in all_samples:
        samples_by_faq_lang.setdefault((s.faq_id, s.lang), []).append(s.phrasing)

    results = []
    for faq in faqs:
        topic = topics.get(faq.topic_id)
        if topic_slug and (not topic or topic.slug != topic_slug):
            continue

        trs = trs_by_faq.get(faq.id, [])  # type: ignore[arg-type]
        if lang:
            trs = [t for t in trs if t.lang == lang]
        if status_filter:
            trs = [t for t in trs if t.status == status_filter]
        if (lang or status_filter) and not trs:
            continue

        results.append(
            {
                "id": faq.id,
                "topic_id": faq.topic_id,
                "topic_slug": topic.slug if topic else "",
                "topic_name": topic.name_en if topic else "",
                "intent_key": faq.intent_key,
                "source_reference": faq.source_reference,
                "is_active": faq.is_active,
                "translations": {
                    t.lang: {
                        "id": t.id,
                        "lang": t.lang,
                        "question_text": t.question_text,
                        "answer_text": t.answer_text,
                        "question_audio_url": t.question_audio_url,
                        "answer_audio_url": t.answer_audio_url,
                        "available_takes": json.loads(t.audio_takes_json) if t.audio_takes_json else [],
                        "voice_name": t.voice_name,
                        "status": t.status,
                        "review_comment": t.review_comment,
                        "regen_requested": t.regen_requested,
                        "has_placeholder": _has_placeholder(t),
                        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                        "samples": samples_by_faq_lang.get((faq.id, t.lang), []),  # type: ignore[arg-type]
                    }
                    for t in trs_by_faq.get(faq.id, [])  # type: ignore[arg-type]
                },
            }
        )

    return {
        "topics": [{"id": t.id, "slug": t.slug, "name_en": t.name_en} for t in topics.values()],
        "items": results,
    }


@router.post("/items", status_code=status.HTTP_201_CREATED)
def create_item(
    body: ItemCreateRequest,
    user: User = Depends(require_role("editor", "admin")),
    session: Session = Depends(get_session),
) -> dict:
    if session.exec(select(FAQItem).where(FAQItem.intent_key == body.intent_key)).first():
        raise HTTPException(status_code=400, detail="intent_key already exists")

    topic = session.get(Topic, body.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    faq = FAQItem(
        topic_id=body.topic_id,
        intent_key=body.intent_key.strip(),
        source_reference=body.source_reference.strip(),
        is_active=True,
    )
    session.add(faq)
    session.flush()

    for l_code, t_payload in body.translations.items():
        tr = Translation(
            faq_id=faq.id,  # type: ignore[arg-type]
            lang=l_code,
            question_text=t_payload.question_text.strip(),
            answer_text=t_payload.answer_text.strip(),
            status="draft",
        )
        session.add(tr)
        for phr in t_payload.samples:
            if phr.strip():
                session.add(SampleQuestion(faq_id=faq.id, lang=l_code, phrasing=phr.strip()))  # type: ignore[arg-type]

    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action="create",
        entity="faq_item",
        entity_id=faq.id,  # type: ignore[arg-type]
        details=f"intent_key={faq.intent_key}",
    )
    session.commit()
    return {"id": faq.id, "intent_key": faq.intent_key}


@router.put("/items/{faq_id}")
def update_item(
    faq_id: int,
    body: ItemUpdateRequest,
    request: Request,
    user: User = Depends(require_role("editor", "admin")),
    session: Session = Depends(get_session),
) -> dict:
    faq = session.get(FAQItem, faq_id)
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ item not found")

    if body.source_reference is not None:
        faq.source_reference = body.source_reference.strip()
    if body.is_active is not None:
        faq.is_active = body.is_active
    session.add(faq)

    for l_code, t_payload in body.translations.items():
        tr = session.exec(
            select(Translation).where(Translation.faq_id == faq_id, Translation.lang == l_code)
        ).first()
        new_q = t_payload.question_text.strip()
        new_a = t_payload.answer_text.strip()
        if tr:
            changed = tr.question_text != new_q or tr.answer_text != new_a
            tr.question_text = new_q
            tr.answer_text = new_a
            # Hard rule: editing an approved translation resets status to draft
            if changed or tr.status != "draft":
                tr.status = "draft"
                tr.clinical_reviewer_id = None
                tr.language_reviewer_id = None
                tr.approved_at = None
            tr.updated_at = utc_now()
            session.add(tr)
        else:
            tr = Translation(
                faq_id=faq_id,
                lang=l_code,
                question_text=new_q,
                answer_text=new_a,
                status="draft",
            )
            session.add(tr)

        old_samples = session.exec(
            select(SampleQuestion).where(SampleQuestion.faq_id == faq_id, SampleQuestion.lang == l_code)
        ).all()
        for osmp in old_samples:
            session.delete(osmp)
        for phr in t_payload.samples:
            if phr.strip():
                session.add(SampleQuestion(faq_id=faq_id, lang=l_code, phrasing=phr.strip()))

    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action="edit_reset_draft",
        entity="faq_item",
        entity_id=faq_id,
    )
    session.commit()
    _refresh_matcher(request, session)
    return {"ok": True, "faq_id": faq_id}


@router.post("/translations/{tr_id}/clinical-review")
def clinical_review_translation(
    tr_id: int,
    body: ReviewActionRequest,
    user: User = Depends(require_role("clinical_reviewer")),
    session: Session = Depends(get_session),
) -> dict:
    tr = session.get(Translation, tr_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Translation not found")

    tr.review_comment = (body.comment or "").strip() or None
    if body.approved:
        tr.status = "clinical_ok"
        tr.clinical_reviewer_id = user.id
        action = "clinical_approve"
    else:
        tr.status = "draft"
        tr.clinical_reviewer_id = None
        tr.language_reviewer_id = None
        action = "clinical_reject"

    tr.updated_at = utc_now()
    session.add(tr)
    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action=action,
        entity="translation",
        entity_id=tr_id,
        details=tr.review_comment,
    )
    session.commit()
    return {"id": tr.id, "status": tr.status}


@router.post("/translations/{tr_id}/language-review")
def language_review_translation(
    tr_id: int,
    body: ReviewActionRequest,
    user: User = Depends(require_role("language_reviewer")),
    session: Session = Depends(get_session),
) -> dict:
    tr = session.get(Translation, tr_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Translation not found")

    # Enforce clinical approval before language approval
    if body.approved:
        en_tr = session.exec(
            select(Translation).where(Translation.faq_id == tr.faq_id, Translation.lang == "en")
        ).first()
        en_clinically_ok = bool(en_tr and en_tr.status in {"clinical_ok", "language_ok", "published"})
        if tr.lang == "en" and tr.status != "clinical_ok":
            raise HTTPException(
                status_code=400,
                detail="English translation must be clinically approved before language approval.",
            )
        if tr.lang != "en" and tr.status != "clinical_ok" and not en_clinically_ok:
            raise HTTPException(
                status_code=400,
                detail="Parent English source must receive clinical approval before language approval.",
            )

    if body.selected_audio_url:
        takes = json.loads(tr.audio_takes_json) if tr.audio_takes_json else []
        if takes and body.selected_audio_url not in takes:
            raise HTTPException(status_code=400, detail="Selected audio take does not belong to this item.")
        tr.answer_audio_url = body.selected_audio_url

    tr.review_comment = (body.comment or "").strip() or None
    if body.approved:
        tr.status = "language_ok"
        tr.language_reviewer_id = user.id
        tr.approved_at = utc_now()
        action = "language_approve"
    else:
        tr.status = "draft"
        tr.language_reviewer_id = None
        action = "language_reject"

    tr.updated_at = utc_now()
    session.add(tr)
    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action=action,
        entity="translation",
        entity_id=tr_id,
        details=tr.review_comment,
    )
    session.commit()
    return {"id": tr.id, "status": tr.status, "answer_audio_url": tr.answer_audio_url}


@router.post("/translations/{tr_id}/publish")
def publish_translation(
    tr_id: int,
    request: Request,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
) -> dict:
    tr = session.get(Translation, tr_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Translation not found")

    if _has_placeholder(tr):
        raise HTTPException(
            status_code=400,
            detail="Cannot publish content containing placeholder prefix '[PLACEHOLDER – NOT REVIEWED]'.",
        )

    if tr.status != "language_ok":
        raise HTTPException(
            status_code=400,
            detail="Item must have both clinical and language approvals (status='language_ok') before publishing.",
        )

    tr.status = "published"
    tr.updated_at = utc_now()
    session.add(tr)
    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action="publish",
        entity="translation",
        entity_id=tr_id,
    )
    session.commit()
    _refresh_matcher(request, session)
    return {"id": tr.id, "status": tr.status}


@router.post("/translations/{tr_id}/regen")
def request_audio_regen(
    tr_id: int,
    user: User = Depends(require_role("editor", "language_reviewer", "admin")),
    session: Session = Depends(get_session),
) -> dict:
    tr = session.get(Translation, tr_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Translation not found")
    tr.regen_requested = True
    tr.updated_at = utc_now()
    session.add(tr)
    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action="queue_audio_regen",
        entity="translation",
        entity_id=tr_id,
    )
    session.commit()
    return {"id": tr.id, "regen_requested": True}


@router.get("/red-flags")
def list_red_flags(
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    rules = session.exec(select(RedFlagRule).order_by(RedFlagRule.lang, RedFlagRule.id)).all()
    return {"rules": [r.model_dump() for r in rules]}


@router.post("/red-flags/{rule_id}/clinical-review")
def clinical_review_red_flag(
    rule_id: int,
    body: ReviewActionRequest,
    user: User = Depends(require_role("clinical_reviewer")),
    session: Session = Depends(get_session),
) -> dict:
    rule = session.get(RedFlagRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Red-flag rule not found")
    rule.status = "clinical_ok" if body.approved else "draft"
    rule.clinical_reviewer_id = user.id if body.approved else None
    session.add(rule)
    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action="red_flag_clinical_approve" if body.approved else "red_flag_clinical_reject",
        entity="red_flag_rule",
        entity_id=rule_id,
        details=body.comment,
    )
    session.commit()
    return {"id": rule.id, "status": rule.status}


@router.post("/red-flags/{rule_id}/publish")
def publish_red_flag(
    rule_id: int,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
) -> dict:
    rule = session.get(RedFlagRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Red-flag rule not found")
    if rule.status != "clinical_ok":
        raise HTTPException(status_code=400, detail="Red-flag rule requires clinical approval first.")
    rule.status = "published"
    session.add(rule)
    record_audit(
        session,
        user_id=user.id,  # type: ignore[arg-type]
        action="red_flag_publish",
        entity="red_flag_rule",
        entity_id=rule_id,
    )
    session.commit()
    return {"id": rule.id, "status": rule.status}


@router.get("/users")
def list_users(
    _user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
) -> dict:
    users = session.exec(select(User).order_by(User.id)).all()
    return {
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ]
    }


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    admin_user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
) -> dict:
    email_clean = body.email.strip().lower()
    if session.exec(select(User).where(User.email == email_clean)).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    u = User(
        name=body.name.strip(),
        email=email_clean,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    session.add(u)
    session.flush()
    record_audit(
        session,
        user_id=admin_user.id,  # type: ignore[arg-type]
        action="create_user",
        entity="user",
        entity_id=u.id,  # type: ignore[arg-type]
        details=f"role={u.role}",
    )
    session.commit()
    return {"id": u.id, "email": u.email, "role": u.role}


@router.post("/clinics", status_code=status.HTTP_201_CREATED)
def create_clinic(
    body: CreateClinicRequest,
    admin_user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
) -> dict:
    c = Clinic(
        name=body.name.strip(),
        lga=body.lga.strip(),
        state=body.state.strip(),
        phone=body.phone.strip(),
        type=body.type.strip(),
        lat=body.lat,
        lng=body.lng,
    )
    session.add(c)
    session.flush()
    record_audit(
        session,
        user_id=admin_user.id,  # type: ignore[arg-type]
        action="create_clinic",
        entity="clinic",
        entity_id=c.id,  # type: ignore[arg-type]
    )
    session.commit()
    return c.model_dump()


@router.get("/stats")
def get_stats(
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    settings = get_settings()
    logs = session.exec(select(QueryLog).order_by(QueryLog.created_at.desc())).all()
    faqs = {f.id: f for f in session.exec(select(FAQItem)).all()}
    topics = {t.id: t for t in session.exec(select(Topic)).all()}

    by_lang: dict[str, int] = {}
    by_outcome: dict[str, int] = {}
    by_topic: dict[str, int] = {}
    thumbs_by_faq: dict[int, dict[str, int | str]] = {}

    for row in logs:
        by_lang[row.lang] = by_lang.get(row.lang, 0) + 1
        by_outcome[row.outcome] = by_outcome.get(row.outcome, 0) + 1
        if row.matched_faq_id and row.matched_faq_id in faqs:
            faq = faqs[row.matched_faq_id]
            tp = topics.get(faq.topic_id)
            if tp:
                by_topic[tp.slug] = by_topic.get(tp.slug, 0) + 1
            if row.rating in (1, -1):
                entry = thumbs_by_faq.setdefault(
                    faq.id,  # type: ignore[arg-type]
                    {"faq_id": faq.id, "intent_key": faq.intent_key, "up": 0, "down": 0},  # type: ignore[arg-type]
                )
                if row.rating == 1:
                    entry["up"] = int(entry["up"]) + 1
                else:
                    entry["down"] = int(entry["down"]) + 1

    unsure_low_conf = [
        {
            "id": r.id,
            "lang": r.lang,
            "confidence": r.confidence,
            "unmatched_text": r.unmatched_text if settings.LOG_UNMATCHED_TEXT else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in sorted(
            [r for r in logs if r.outcome == "unsure"],
            key=lambda x: x.confidence if x.confidence is not None else 0.0,
        )[:20]
    ]

    audits = session.exec(select(AuditLog).order_by(AuditLog.timestamp.desc())).all()[:50]
    users = {u.id: u.name for u in session.exec(select(User)).all()}

    return {
        "total_queries": len(logs),
        "red_flag_count": by_outcome.get("red_flag", 0),
        "by_lang": by_lang,
        "by_outcome": by_outcome,
        "by_topic": by_topic,
        "thumbs_by_faq": list(thumbs_by_faq.values()),
        "lowest_confidence_unsure": unsure_low_conf,
        "log_unmatched_text_enabled": settings.LOG_UNMATCHED_TEXT,
        "audit_logs": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "user_name": users.get(a.user_id, f"User #{a.user_id}"),
                "action": a.action,
                "entity": a.entity,
                "entity_id": a.entity_id,
                "details": a.details,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in audits
        ],
    }
