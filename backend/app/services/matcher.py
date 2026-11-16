"""In-memory multilingual FAQ matcher (embeddings + RapidFuzz lexical fallback)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sqlmodel import Session, select

from app.models import PLACEHOLDER_PREFIX, FAQItem, SampleQuestion, Translation
from app.services.redflag import normalize_text


def clean_indexed_text(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith(PLACEHOLDER_PREFIX):
        stripped = stripped[len(PLACEHOLDER_PREFIX) :].strip()
    return stripped


@dataclass
class IndexedEntry:
    faq_id: int
    lang: str
    raw_text: str
    folded_text: str
    display_question: str
    question_audio_url: Optional[str]


@dataclass
class MatchCandidate:
    faq_id: int
    question: str
    question_audio_url: Optional[str]
    score: float


@dataclass
class MatchResult:
    outcome: str  # "answer" | "unsure"
    faq_id: Optional[int]
    confidence: float
    candidates: list[MatchCandidate]


class FAQMatcher:
    def __init__(self, model_name: str = "sentence-transformers/LaBSE", disable_heavy: bool = False) -> None:
        self.model_name = model_name
        self.disable_heavy = disable_heavy
        self._st_model = None
        self._st_tried = False
        self._tfidf: Optional[TfidfVectorizer] = None
        self._entries: list[IndexedEntry] = []
        self._matrix: Optional[np.ndarray] = None
        self._faq_meta: dict[tuple[int, str], tuple[str, Optional[str]]] = {}

    def _load_sentence_transformer(self):
        if self._st_tried or self.disable_heavy:
            return self._st_model
        self._st_tried = True
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            self._st_model = SentenceTransformer(self.model_name)
        except Exception:
            self._st_model = None
        return self._st_model

    def _fit_vectors(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 1), dtype=np.float32)

        model = self._load_sentence_transformer()
        if model is not None:
            vecs = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
            return np.asarray(vecs, dtype=np.float32)

        self._tfidf = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            sublinear_tf=True,
            lowercase=True,
        )
        mat = self._tfidf.fit_transform(texts).toarray().astype(np.float32)
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return mat / norms

    def _encode_query(self, query_folded: str) -> np.ndarray:
        if self._st_model is not None:
            vec = self._st_model.encode([query_folded], normalize_embeddings=True, convert_to_numpy=True)
            return np.asarray(vec[0], dtype=np.float32)

        assert self._tfidf is not None
        vec = self._tfidf.transform([query_folded]).toarray().astype(np.float32)[0]
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
        return vec

    def build_index(self, session: Session) -> int:
        active_faqs = {
            f.id: f
            for f in session.exec(select(FAQItem).where(FAQItem.is_active == True)).all()  # noqa: E712
        }
        published_trs = session.exec(
            select(Translation).where(Translation.status == "published")
        ).all()

        published_pairs: set[tuple[int, str]] = set()
        faq_meta: dict[tuple[int, str], tuple[str, Optional[str]]] = {}
        entries: list[IndexedEntry] = []

        for tr in published_trs:
            if tr.faq_id not in active_faqs:
                continue
            published_pairs.add((tr.faq_id, tr.lang))
            faq_meta[(tr.faq_id, tr.lang)] = (tr.question_text, tr.question_audio_url)
            q_clean = clean_indexed_text(tr.question_text)
            raw_norm, folded_norm = normalize_text(q_clean)
            if folded_norm:
                entries.append(
                    IndexedEntry(
                        faq_id=tr.faq_id,
                        lang=tr.lang,
                        raw_text=raw_norm,
                        folded_text=folded_norm,
                        display_question=tr.question_text,
                        question_audio_url=tr.question_audio_url,
                    )
                )

        samples = session.exec(select(SampleQuestion)).all()
        for smp in samples:
            if (smp.faq_id, smp.lang) not in published_pairs:
                continue
            disp_q, q_audio = faq_meta[(smp.faq_id, smp.lang)]
            raw_norm, folded_norm = normalize_text(smp.phrasing)
            if folded_norm:
                entries.append(
                    IndexedEntry(
                        faq_id=smp.faq_id,
                        lang=smp.lang,
                        raw_text=raw_norm,
                        folded_text=folded_norm,
                        display_question=disp_q,
                        question_audio_url=q_audio,
                    )
                )

        self._entries = entries
        self._faq_meta = faq_meta
        self._matrix = self._fit_vectors([e.folded_text for e in entries])
        return len(entries)

    def match(
        self,
        query: str,
        lang: str,
        threshold: float = 0.62,
        margin: float = 0.03,
    ) -> MatchResult:
        raw_q, folded_q = normalize_text(query)
        if not folded_q or not self._entries or self._matrix is None:
            return MatchResult(outcome="unsure", faq_id=None, confidence=0.0, candidates=[])

        q_vec = self._encode_query(folded_q)
        cos_scores = np.dot(self._matrix, q_vec)

        best_by_faq: dict[int, float] = {}
        for idx, entry in enumerate(self._entries):
            if entry.lang != lang and entry.lang != "en":
                continue

            cos_sim = float(max(0.0, min(1.0, cos_scores[idx])))
            fuzzy_raw = fuzz.token_set_ratio(raw_q, entry.raw_text)
            fuzzy_folded = fuzz.token_set_ratio(folded_q, entry.folded_text)
            fuzzy_sim = max(fuzzy_raw, fuzzy_folded) / 100.0

            combined = 0.8 * cos_sim + 0.2 * fuzzy_sim
            if lang != "en" and entry.lang == "en":
                combined *= 0.95

            prev = best_by_faq.get(entry.faq_id, -1.0)
            if combined > prev:
                best_by_faq[entry.faq_id] = combined

        if not best_by_faq:
            return MatchResult(outcome="unsure", faq_id=None, confidence=0.0, candidates=[])

        ranked = sorted(best_by_faq.items(), key=lambda kv: kv[1], reverse=True)
        candidates: list[MatchCandidate] = []
        for faq_id, score in ranked[:3]:
            meta = self._faq_meta.get((faq_id, lang)) or self._faq_meta.get((faq_id, "en"))
            q_text, q_audio = meta if meta else ("", None)
            candidates.append(
                MatchCandidate(
                    faq_id=faq_id,
                    question=q_text,
                    question_audio_url=q_audio,
                    score=round(score, 4),
                )
            )

        best_faq_id, best_score = ranked[0]
        runner_up_score = ranked[1][1] if len(ranked) > 1 else 0.0

        if best_score >= threshold and (len(ranked) == 1 or (best_score - runner_up_score) >= margin):
            return MatchResult(
                outcome="answer",
                faq_id=best_faq_id,
                confidence=round(best_score, 4),
                candidates=candidates,
            )

        return MatchResult(
            outcome="unsure",
            faq_id=None,
            confidence=round(best_score, 4),
            candidates=candidates,
        )
