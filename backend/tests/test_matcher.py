"""Tests for hybrid multilingual FAQ matcher."""

from sqlmodel import select

from app.models import FAQItem
from app.services.matcher import FAQMatcher


def test_known_phrasings_match_expected_faq(seeded_session):
    matcher = FAQMatcher(disable_heavy=True)
    count = matcher.build_index(seeded_session)
    assert count > 60

    faq_by_key = {f.intent_key: f.id for f in seeded_session.exec(select(FAQItem)).all()}

    cases = [
        ("en", "how do i prepare oral rehydration salt for my child", "ors_how_to_prepare"),
        ("en", "should i test for malaria before taking drugs", "malaria_test_before_treat"),
        ("yo", "bawo ni a se n po ors", "ors_how_to_prepare"),
        ("pcm", "how i go mix ors water for my pikin wey dey purge", "ors_how_to_prepare"),
        ("en", "can i drink agbo with my bp medicine", "hypertension_herbal_mix_warning"),
    ]
    for lang, query, expected_key in cases:
        res = matcher.match(query, lang=lang, threshold=0.62, margin=0.03)
        assert res.outcome == "answer", f"Expected answer for '{query}', got {res}"
        assert res.faq_id == faq_by_key[expected_key]


def test_nonsense_returns_unsure_with_candidates(seeded_session):
    matcher = FAQMatcher(disable_heavy=True)
    matcher.build_index(seeded_session)

    res = matcher.match("qwertyuiop zxcvbnm 12345 xyz", lang="en", threshold=0.62, margin=0.03)
    assert res.outcome == "unsure"
    assert res.faq_id is None
    assert len(res.candidates) == 3


def test_high_threshold_forces_unsure(seeded_session):
    matcher = FAQMatcher(disable_heavy=True)
    matcher.build_index(seeded_session)

    res = matcher.match("mix salt packet for baby", lang="en", threshold=0.99, margin=0.03)
    assert res.outcome == "unsure"
