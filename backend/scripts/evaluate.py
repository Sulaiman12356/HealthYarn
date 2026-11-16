"""Evaluate HealthYarn red-flag recall, matching accuracy, and threshold sweep.

Usage:
  python -m scripts.evaluate
  python -m scripts.evaluate --sweep
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from pathlib import Path

from sqlmodel import Session, select

from app.config import get_settings
from app.db import engine, init_db
from app.models import FAQItem
from app.services.matcher import FAQMatcher
from app.services.redflag import check_red_flags
from app.services.stt import get_stt_provider


def evaluate_once(
    session: Session,
    matcher: FAQMatcher,
    cases: list[dict],
    faq_id_to_key: dict[int, str],
    threshold: float,
    margin: float = 0.03,
    run_stt: bool = False,
) -> dict:
    settings = get_settings()
    stt = get_stt_provider(settings) if run_stt else None

    per_lang: dict[str, dict[str, int]] = {
        "en": {"total_faq": 0, "correct": 0, "wrong": 0, "unsure": 0},
        "yo": {"total_faq": 0, "correct": 0, "wrong": 0, "unsure": 0},
        "ig": {"total_faq": 0, "correct": 0, "wrong": 0, "unsure": 0},
    }
    rf_tp = rf_fn = rf_fp = 0
    none_total = none_correct = 0
    latencies_ms: list[float] = []
    confusions: list[dict] = []

    for case in cases:
        lang = case["lang"]
        raw_input = case["text_or_audio_path"]
        expected = case["expected_faq_id"]

        t0 = time.perf_counter()
        query_text = raw_input
        candidate_path = Path(raw_input)
        if stt is not None and candidate_path.exists() and candidate_path.is_file():
            query_text = asyncio.run(stt.transcribe(candidate_path.read_bytes(), lang))

        rf_hit = check_red_flags(session, query_text, lang)
        if rf_hit is not None:
            predicted = "RED_FLAG"
        else:
            match_res = matcher.match(query_text, lang=lang, threshold=threshold, margin=margin)
            if match_res.outcome == "answer" and match_res.faq_id is not None:
                predicted = faq_id_to_key.get(match_res.faq_id, str(match_res.faq_id))
            else:
                predicted = "NONE"

        latencies_ms.append((time.perf_counter() - t0) * 1000.0)

        if expected == "RED_FLAG":
            if predicted == "RED_FLAG":
                rf_tp += 1
            else:
                rf_fn += 1
                confusions.append({"lang": lang, "query": query_text, "expected": expected, "predicted": predicted})
        else:
            if predicted == "RED_FLAG":
                rf_fp += 1
                confusions.append({"lang": lang, "query": query_text, "expected": expected, "predicted": predicted})

            if expected == "NONE":
                none_total += 1
                if predicted == "NONE":
                    none_correct += 1
                else:
                    confusions.append({"lang": lang, "query": query_text, "expected": expected, "predicted": predicted})
            else:
                bucket = per_lang.setdefault(lang, {"total_faq": 0, "correct": 0, "wrong": 0, "unsure": 0})
                bucket["total_faq"] += 1
                if predicted == expected:
                    bucket["correct"] += 1
                elif predicted == "NONE":
                    bucket["unsure"] += 1
                else:
                    bucket["wrong"] += 1
                    confusions.append({"lang": lang, "query": query_text, "expected": expected, "predicted": predicted})

    total_faq_cases = sum(v["total_faq"] for v in per_lang.values())
    total_correct = sum(v["correct"] for v in per_lang.values())
    total_wrong = sum(v["wrong"] for v in per_lang.values())
    total_unsure = sum(v["unsure"] for v in per_lang.values())

    overall_acc = (total_correct / total_faq_cases) if total_faq_cases else 0.0
    wrong_rate = (total_wrong / total_faq_cases) if total_faq_cases else 0.0
    unsure_rate = (total_unsure / total_faq_cases) if total_faq_cases else 0.0
    rf_recall = (rf_tp / (rf_tp + rf_fn)) if (rf_tp + rf_fn) else 1.0
    rf_precision = (rf_tp / (rf_tp + rf_fp)) if (rf_tp + rf_fp) else 1.0
    avg_latency = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0

    return {
        "threshold": round(threshold, 2),
        "per_lang": per_lang,
        "overall_accuracy": overall_acc,
        "wrong_rate": wrong_rate,
        "unsure_rate": unsure_rate,
        "none_rejection_rate": (none_correct / none_total) if none_total else 1.0,
        "red_flag_recall": rf_recall,
        "red_flag_precision": rf_precision,
        "avg_latency_ms": avg_latency,
        "confusions": confusions,
    }


def write_results_markdown(report: dict, sweep_rows: list[dict], recommended: dict | None, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# HealthYarn Evaluation Results (`evaluate.py`)",
        "",
        f"- **Evaluated threshold**: `{report['threshold']}`",
        f"- **Red-flag recall**: **{report['red_flag_recall'] * 100:.1f}%**",
        f"- **Red-flag precision**: **{report['red_flag_precision'] * 100:.1f}%**",
        f"- **Overall FAQ accuracy**: **{report['overall_accuracy'] * 100:.1f}%**",
        f"- **Wrong match rate**: **{report['wrong_rate'] * 100:.1f}%**",
        f"- **Unsure fallback rate**: **{report['unsure_rate'] * 100:.1f}%**",
        f"- **Out-of-scope (`NONE`) rejection accuracy**: **{report['none_rejection_rate'] * 100:.1f}%**",
        f"- **Average pipeline latency**: `{report['avg_latency_ms']:.2f} ms`",
        "",
        "## Per-Language Breakdown",
        "",
        "| Language | FAQ Cases | Correct | Unsure | Wrong | Accuracy |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for lang, m in report["per_lang"].items():
        acc = (m["correct"] / m["total_faq"] * 100.0) if m["total_faq"] else 0.0
        lines.append(
            f"| `{lang}` | {m['total_faq']} | {m['correct']} | {m['unsure']} | {m['wrong']} | {acc:.1f}% |"
        )

    if recommended:
        lines.extend(
            [
                "",
                "## Threshold Sweep Summary (`0.45` – `0.80`)",
                "",
                f"- **Recommended `MATCH_THRESHOLD`**: **`{recommended['threshold']:.2f}`** "
                f"(Accuracy `{recommended['overall_accuracy'] * 100:.1f}%`, "
                f"Wrong rate `{recommended['wrong_rate'] * 100:.1f}%`, "
                f"Unsure rate `{recommended['unsure_rate'] * 100:.1f}%`)",
                "",
                "| Threshold | Accuracy | Wrong Rate | Unsure Rate | Red-Flag Recall |",
                "| ---: | ---: | ---: | ---: | ---: |",
            ]
        )
        for row in sweep_rows:
            if int(round(row["threshold"] * 100)) % 5 == 0 or row["threshold"] == recommended["threshold"]:
                lines.append(
                    f"| `{row['threshold']:.2f}` | {row['overall_accuracy'] * 100:.1f}% | "
                    f"{row['wrong_rate'] * 100:.1f}% | {row['unsure_rate'] * 100:.1f}% | "
                    f"{row['red_flag_recall'] * 100:.1f}% |"
                )

    lines.extend(["", "## Confusion List", ""])
    if not report["confusions"]:
        lines.append("No misclassifications or false red-flag hits observed.")
    else:
        for c in report["confusions"]:
            lines.append(
                f"- `[{c['lang']}]` \"{c['query']}\" -> expected `{c['expected']}`, got `{c['predicted']}`"
            )

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate HealthYarn red-flag and matching pipeline.")
    parser.add_argument("--sweep", action="store_true", help="Sweep MATCH_THRESHOLD from 0.45 to 0.80.")
    args = parser.parse_args()

    settings = get_settings()
    init_db(engine)
    cases = json.loads((settings.content_dir / "test_set.json").read_text(encoding="utf-8"))

    with Session(engine) as session:
        faqs = session.exec(select(FAQItem)).all()
        faq_id_to_key = {f.id: f.intent_key for f in faqs if f.id is not None}
        matcher = FAQMatcher(
            model_name=settings.EMBEDDING_MODEL,
            disable_heavy=settings.DISABLE_HEAVY_EMBEDDINGS,
        )
        matcher.build_index(session)

        sweep_rows: list[dict] = []
        recommended: dict | None = None
        if args.sweep:
            for step in range(45, 81):
                thr = step / 100.0
                res = evaluate_once(session, matcher, cases, faq_id_to_key, threshold=thr, margin=settings.MATCH_MARGIN)
                sweep_rows.append(res)
            eligible = [
                r for r in sweep_rows if r["wrong_rate"] <= 0.05 and r["none_rejection_rate"] >= 0.95
            ]
            if not eligible:
                eligible = [r for r in sweep_rows if r["wrong_rate"] <= 0.05]
            pool = eligible if eligible else sweep_rows
            recommended = max(
                pool,
                key=lambda r: (r["overall_accuracy"], r["none_rejection_rate"], -r["wrong_rate"], r["threshold"]),
            )
            active_thr = recommended["threshold"]
        else:
            active_thr = settings.MATCH_THRESHOLD

        report = evaluate_once(
            session,
            matcher,
            cases,
            faq_id_to_key,
            threshold=active_thr,
            margin=settings.MATCH_MARGIN,
        )

    out_path = settings.content_dir.parent / "docs" / "TESTING_RESULTS.md"
    write_results_markdown(report, sweep_rows, recommended, out_path)

    print(f"Red-flag recall: {report['red_flag_recall']*100:.1f}% | precision: {report['red_flag_precision']*100:.1f}%")
    print(f"Overall accuracy: {report['overall_accuracy']*100:.1f}% | wrong: {report['wrong_rate']*100:.1f}% | unsure: {report['unsure_rate']*100:.1f}%")
    print(f"Avg latency: {report['avg_latency_ms']:.2f} ms")
    for lang, m in report["per_lang"].items():
        acc = (m["correct"] / m["total_faq"] * 100.0) if m["total_faq"] else 0.0
        print(f"  {lang}: {m['correct']}/{m['total_faq']} ({acc:.1f}%), wrong={m['wrong']}, unsure={m['unsure']}")
    if recommended:
        print(f"Recommended MATCH_THRESHOLD: {recommended['threshold']:.2f}")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
