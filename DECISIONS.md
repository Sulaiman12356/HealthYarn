# Architecture & Engineering Decisions (`DECISIONS.md`)

This log records pragmatic engineering decisions made during the HealthYarn ITDC 2026 prototype build whenever a requirement left implementation details open.

## 1. Local Audio Synthesis Fallback (`--demo-synth`) & Format Compatibility
- **Context**: YarnGPT (`saheedniyi/YarnGPT2b`) requires a CUDA GPU (~16 GB VRAM) and `ffmpeg` is not pre-installed on the local Windows build host.
- **Decision**: `backend/scripts/generate_audio.py` implements full YarnGPT + `ffmpeg` Opus (`.ogg`) synthesis as the primary pipeline (paired with `notebooks/generate_audio_colab.ipynb` for GPU execution), and provides `--demo-synth` which generates valid, browser-playable, speech-cadence WAV/OGG-compatible audio clips locally with zero external binary dependencies. Audio files use content-hashed filenames (`{lang}/{intent_key}_{answer|question}_{sha1(text)[:8]}.ogg` or `.wav` when `--demo-synth` runs without `ffmpeg`) so cache invalidation works identically.

## 2. Hybrid Matcher Resilience (`LaBSE` + Multilingual Character/Word N-Gram Fallback)
- **Context**: `sentence-transformers/LaBSE` (~1.8 GB) provides strong cross-lingual embeddings across Yorùbá, Igbo, and English, while local CI/test runs or restricted environments may not have `torch`/`LaBSE` weights downloaded yet.
- **Decision**: `backend/app/services/matcher.py` loads `sentence-transformers` (`settings.EMBEDDING_MODEL`) when available and `DISABLE_HEAVY_EMBEDDINGS` is not set; if unavailable, it transparently falls back to an in-memory character n-gram (`3..5`) + word TF-IDF cosine scorer (via `scikit-learn` / `numpy`) blended identically with `rapidfuzz.fuzz.token_set_ratio` (`0.8 * cosine + 0.2 * fuzzy / 100`). Diacritics are stripped via NFD normalization on a secondary copy so tone-mark differences in Yorùbá/Igbo do not break matching.

## 3. Password Hashing with `bcrypt` Directly
- **Context**: `bcrypt 5.0.0` is installed in the Python 3.11 environment alongside `passlib 1.7.4`, and `passlib`'s bcrypt handler raises compatibility issues with `bcrypt >= 4.1` (`__about__` removal and strict 72-byte behavior).
- **Decision**: `backend/app/auth.py` uses `bcrypt.hashpw` / `bcrypt.checkpw` directly (pre-enforcing minimum 10-character password length and UTF-8 byte boundary safety) rather than routing through `passlib.context.CryptContext`.

## 4. Placeholder Content Safety Guard & Demo Mode Banner
- **Context**: Real medical copy and native Yorùbá/Igbo translations are supplied by clinical and language reviewers; generated seed copy must clearly avoid impersonating reviewed medical advice.
- **Decision**: All seeded FAQ texts in `content/faqs.json` are prefixed with `[PLACEHOLDER – NOT REVIEWED]` and marked `status: "draft"`. Both `scripts/seed.py` and `/api/admin` publish routes block publishing placeholder text unless `seed.py --demo` is run explicitly for local demo databases, which sets `demo_mode = true` in `/api/bundle` and `/api/meta` and renders a persistent **"DEMO CONTENT — NOT CLINICALLY REVIEWED"** banner in the frontend.

## 5. Impeccable Visual System (`Operate` Mode, Code-Led)
- **Context**: Public users browse outdoors on low-end Android devices (2 GB RAM, 3G) with varying English literacy, requiring instant zero-network-font rendering and high outdoor readability.
- **Decision**: Derived Candidate 4 ("Nigerian PHC Daylight Triage Desk", `seed:18a533a2efee3fba`) via `impeccable concept-seed`. Uses a sunlit plaster ground (`#F7F6F2`), pure white reading plates (`#FFFFFF`), deep PHC viridian (`#0F523B`) primary controls, and clinical crimson (`#B91C1C`) quarantined strictly to the 5-second non-dismissable Red-Flag alert. System humanist sans stack (`"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) avoids external font payloads and renders Yorùbá/Igbo diacritics cleanly offline.
