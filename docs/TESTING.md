# HealthYarn Testing & Evaluation Guide (`docs/TESTING.md`)

## 1. Backend Automated Test Suite (`pytest`)

```powershell
cd backend
pytest -v
```

Test coverage (`32` tests):
- **`tests/test_redflag.py`**: Verifies all red-flag patterns across `en`, `yo`, `ig`, diacritic-stripped Yorùbá/Igbo inputs, and English code-switching inside local-language sessions; confirms zero false positives on routine FAQs.
- **`tests/test_matcher.py`**: Verifies exact and paraphrased queries map to expected `faq_id`s, out-of-scope gibberish returns `unsure` with 3 candidates, and threshold boundaries are enforced.
- **`tests/test_ask_api.py`**: Exercises `POST /api/ask` with `MockSTT` across `answer`, `unsure`, `red_flag`, and `stt_failed` (including timeout); validates rejection of `> 1 MB` files, `> 15 s` durations, and unsupported MIME types; verifies **zero audio files written to disk** and **zero transcripts stored in DB** across 20 sequential queries.
- **`tests/test_admin_rbac.py`**: Verifies the 4-role RBAC permission matrix, CSRF requirement on state-changing routes, draft reset upon editing, clinical-before-language approval gating, placeholder publish block, and `audit_log` persistence.
- **`tests/test_seed_safety.py`**: Verifies `scripts/seed.py` refuses to publish `[PLACEHOLDER – NOT REVIEWED]` items without `--demo` and public routes never return non-published items.

## 2. Threshold Sweep & Accuracy Evaluation (`evaluate.py`)

```powershell
cd backend
python -m scripts.evaluate --sweep
```

Evaluates `content/test_set.json` across `0.45`–`0.80` thresholds, prints per-language metrics and confusion lists, recommends the threshold maximising accuracy with `wrong_rate <= 5%` and high out-of-scope rejection, and writes `docs/TESTING_RESULTS.md`.

## 3. Frontend Unit & Component Tests (`Vitest`)

```powershell
cd frontend
npm.cmd run test -- --run
```

Tests:
- Language selection persistence in `localStorage`
- Answer screen rendering, audio playback, and chained disclaimer audio URL
- Red-flag urgent alert 5-second non-dismissable safety lock (`vi.useFakeTimers`)
- Offline mode (`navigator.onLine = false`) rendering cached topics and answers

## 4. Privacy Verification Command (Zero Audio / Transcripts on Disk)

After running 20 queries against `/api/ask`, confirm zero uploaded recordings exist on disk and zero transcripts were persisted in SQLite:

```powershell
python -c "import sqlite3; c=sqlite3.connect('backend/healthyarn.db'); print('Rows:', c.execute('SELECT COUNT(*) FROM query_logs').fetchone()[0]); print('Non-null unmatched_text:', c.execute('SELECT COUNT(*) FROM query_logs WHERE unmatched_text IS NOT NULL').fetchone()[0])"
```
