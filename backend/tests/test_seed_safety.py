"""Tests ensuring placeholder content cannot be published or served unless --demo is passed."""

import json
import pytest
from sqlmodel import Session, select

from app.models import PLACEHOLDER_PREFIX, Translation
from scripts.seed import seed_database


def test_seed_refuses_publishing_placeholders_without_demo(tmp_path, test_engine):
    bad_faqs = [
        {
            "intent_key": "test_placeholder",
            "topic": "malaria",
            "source_reference": "Test",
            "translations": {
                "en": {
                    "question": f"{PLACEHOLDER_PREFIX} Test question?",
                    "answer": f"{PLACEHOLDER_PREFIX} Test answer.",
                    "status": "published",
                }
            },
            "samples": {"en": ["test question"]},
        }
    ]
    (tmp_path / "topics.json").write_text(
        json.dumps([{"slug": "malaria", "icon": "shield-plus", "sort_order": 1, "names": {"en": "Malaria"}}]),
        encoding="utf-8",
    )
    (tmp_path / "faqs.json").write_text(json.dumps(bad_faqs), encoding="utf-8")
    (tmp_path / "red_flags.json").write_text("[]", encoding="utf-8")
    (tmp_path / "clinics.json").write_text("[]", encoding="utf-8")
    (tmp_path / "system_messages.json").write_text("[]", encoding="utf-8")

    with Session(test_engine) as session:
        with pytest.raises(ValueError, match="without --demo"):
            seed_database(session, tmp_path, demo=False)


def test_public_endpoints_never_serve_unpublished_items(client, seeded_session):
    # Mark FAQ 1 EN back to draft
    tr = seeded_session.exec(
        select(Translation).where(Translation.faq_id == 1, Translation.lang == "en")
    ).first()
    assert tr is not None
    tr.status = "draft"
    seeded_session.add(tr)
    seeded_session.commit()

    r_ans = client.get("/api/answers/1?lang=en")
    assert r_ans.status_code == 404

    r_topics = client.get("/api/topics?lang=en")
    assert r_topics.status_code == 200
    all_faq_ids = [
        q["faq_id"]
        for topic in r_topics.json()["topics"]
        for q in topic["questions"]
    ]
    assert 1 not in all_faq_ids


def test_meta_exposes_content_reviewed_and_sample_audio(client, seeded_session):
    r_meta = client.get("/api/meta")
    assert r_meta.status_code == 200
    data = r_meta.json()
    assert "content_reviewed" in data
    assert isinstance(data["content_reviewed"], bool)
    assert set(data["sample_audio"].keys()) == {"en", "pcm", "yo"}
    assert set(data["hero_audio"].keys()) == {"en", "pcm", "yo"}

    r_bundle = client.get("/api/bundle?lang=pcm")
    assert r_bundle.status_code == 200
    bdata = r_bundle.json()
    assert "content_reviewed" in bdata
    assert bdata["lang"] == "pcm"
