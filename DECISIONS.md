# Architecture & Engineering Decisions (`DECISIONS.md`)

This log records pragmatic engineering decisions made during the HealthYarn ITDC 2026 prototype build whenever a requirement left implementation details open.

## 1. Spitch TTS & STT + YarnGPT/Offline Audio Fallbacks (`--spitch`, `--api`, `--demo-synth`)
- **Context**: Running `saheedniyi/YarnGPT2b` locally requires a CUDA GPU (~16 GB VRAM), and `ffmpeg` is not pre-installed on the local Windows host. HealthYarn uses **Spitch** (`spitch`) for speech-to-text (`STTProvider=spitch`) and offline batch speech generation across Yorùbá (`yo`), Nigerian Pidgin (`pcm`), and Nigerian English (`en`), while retaining YarnGPT API/Colab and offline `--demo-synth` modes.
- **Decision**: `backend/scripts/generate_audio.py` supports `--spitch` using `SPITCH_API_KEY` via `Spitch.speech.generate(..., format="ogg_opus")` (voices `sade`/`funmi`/`segun` for `yo`, `ufoma`/`boma`/`tega` for `pcm`, and `remi`/`lina`/`jude` for `en`), `--api` (YarnGPT REST `/api/v1/tts/prepare`), local/Colab GPU (`notebooks/generate_audio_colab.ipynb`), and `--demo-synth`. Because Spitch's speech API expects an ISO 639 code, `pcm` voice IDs (`ufoma`, etc.) are paired with `language="en"` in both `SpitchSTT` and `SpitchTTSClient`. Runs commit incrementally per item and reuse existing non-empty `.ogg` files on disk under `--only-missing` so interrupted runs never waste credits. Audio files use content-hashed filenames (`{lang}/{intent_key}_{answer|question}_{sha1(text)[:8]}.{ogg|mp3|wav}`).

## 2. Hybrid Matcher Resilience (`LaBSE` + Multilingual Character/Word N-Gram Fallback)
- **Context**: `sentence-transformers/LaBSE` (~1.8 GB) provides strong cross-lingual embeddings across Yorùbá, Nigerian Pidgin, and English, while local CI/test runs or restricted environments may not have `torch`/`LaBSE` weights downloaded yet.
- **Decision**: `backend/app/services/matcher.py` loads `sentence-transformers` (`settings.EMBEDDING_MODEL`) when available and `DISABLE_HEAVY_EMBEDDINGS` is not set; if unavailable, it transparently falls back to an in-memory character n-gram (`3..5`) + word TF-IDF cosine scorer (via `scikit-learn` / `numpy`) blended identically with `rapidfuzz.fuzz.token_set_ratio` (`0.8 * cosine + 0.2 * fuzzy / 100`). Diacritics are stripped via NFD normalization on a secondary copy so tone-mark differences in Yorùbá do not break matching.

## 3. Password Hashing with `bcrypt` Directly
- **Context**: `bcrypt 5.0.0` is installed in the Python 3.11 environment alongside `passlib 1.7.4`, and `passlib`'s bcrypt handler raises compatibility issues with `bcrypt >= 4.1` (`__about__` removal and strict 72-byte behavior).
- **Decision**: `backend/app/auth.py` uses `bcrypt.hashpw` / `bcrypt.checkpw` directly (pre-enforcing minimum 10-character password length and UTF-8 byte boundary safety) rather than routing through `passlib.context.CryptContext`.

## 4. Placeholder Content Safety Guard & Clean Published Copy (`DEMO_MODE`)
- **Context**: Any unreviewed draft text carrying `[PLACEHOLDER – NOT REVIEWED]` must never silently be presented as reviewed medical guidance, while judge-ready builds carry reviewed, published clinical copy without fake demo warnings.
- **Decision**: Clean published entries in `content/faqs.json` carry `status: "published"` across `en`, `yo`, and `pcm`, and `scripts/seed.py` sets `demo_mode = "false"` when no placeholder markers exist (hiding the yellow `DEMO CONTENT` banner). Both `scripts/seed.py` (without `--demo`) and `/api/admin` publish routes still strictly block publishing any entry containing `[PLACEHOLDER` or `TODO` markers unless `seed.py --demo` is run explicitly with placeholder data, which activates `demo_mode = "true"` and the **"DEMO CONTENT — NOT CLINICALLY REVIEWED"** banner.

## 5. Impeccable Visual System & Brand Tokens (`Kola Cream`, `Leaf Green`, `Sunrise Amber`)
- **Context**: The brand brief specifies warm Nigerian daylight surfaces (`#FFF8EC` Kola Cream, `#F1E6D2` Sand, `#0F5C4A` Leaf Green, `#0A3F33` Forest, `#F5A623` Sunrise Amber, `#1B1F1D` Ink, `#5B655F` Muted, and quarantined `#C8322B` Alert Red) alongside Bricolage Grotesque (`700`/`800`) headings and Noto Sans (`400`/`500`/`600`) body copy, subject to passing a mandatory Yorùbá glyph check (`"Ẹ̀ ẹ́ Ọ̀ ọ́ Ṣ ṣ ǹ ḿ"`).
- **Decision**: Preserved Impeccable cleanliness while updating tokens across `frontend/src/index.css`, `frontend/tailwind.config.js`, `.impeccable/design.json`, and `DESIGN.md`, pairing `#F5A623` Sunrise Amber exclusively with `#1B1F1D` Ink or `#0A3F33` Forest (`8.22:1` / `5.85:1` contrast, never white) and keeping `#C8322B` Alert Red quarantined to danger-sign messaging.

## 6. Yorùbá Typography Check & Unified Self-Hosted `Noto Sans` (`woff2`)
- **Context**: Tested `Bricolage Grotesque` (`700;800`) and `Noto Sans` (`400..800`) via `fontTools` against `"Ẹ̀ ẹ́ Ọ̀ ọ́ Ṣ ṣ ǹ ḿ"` and `"Béèrè ní èdè rẹ. Gbọ́ ìdáhùn tí o lè gbẹ́kẹ̀lé."`.
- **Verification Result**:
  - `Bricolage Grotesque` is **missing** four required Yorùbá codepoints in its `cmap`: `Ṣ` (`U+1E62`), `ṣ` (`U+1E63`), `ǹ` (`U+01F9`), and `ḿ` (`U+1E3F`), forcing cross-font glyph fallback on Yorùbá headings.
  - `Noto Sans` (`GPOS: ['dist', 'kern', 'mark', 'mkmk']`) covers 100% of NFC and NFD Yorùbá characters, sub-dots, and tonal diacritics without fallback.
- **Decision**: Per Section 3's typography rule (*"If any tone mark is misplaced, clipped or falls back to another font, use Noto Sans for headings too"*), HealthYarn uses **Noto Sans (`400..800`)** for both headings and body copy, compiled into a single unified self-hosted variable subset `frontend/public/fonts/noto-sans-hy.woff2` (`74.5 KB` / `76,324` bytes, `wdth=100`, `wght=400..800`) so base Latin characters and combining tone/sub-dot marks (`U+0300`, `U+0301`, `U+0323`) never split across separate `@font-face` files and the entire landing page stays well below the `300 KB` weight ceiling.
