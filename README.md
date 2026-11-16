# HealthYarn — Voice-First Multilingual Health Guidance (ITDC 2026)

**HealthYarn** is an offline-resilient, voice-first healthcare information Progressive Web App built for the **NCS IT Development Contest (ITDC 2026)** (*Innovative Digital Solutions for Intelligent and Accessible Healthcare Delivery*).

Users ask health questions out loud in **Yorùbá (`yo`)**, **Igbo (`ig`)**, or **Nigerian English (`en`)**—or browse topics 100% offline—and hear pre-approved, clinically and linguistically reviewed answers spoken in a natural Nigerian voice.

---

## Core Safety & Architecture Rules

1. **Zero Generated Medical Advice at Runtime**: No LLM generates or rewrites medical text at runtime. AI only transcribes speech (`STTProvider`) and matches against `published` FAQ entries (`FAQMatcher`).
2. **Offline Batch TTS Only (`YarnGPT`)**: Approved text is converted to compressed audio offline via `backend/scripts/generate_audio.py` and `notebooks/generate_audio_colab.ipynb` (never used for ASR).
3. **Red-Flag Safety First**: Queries (raw + NFD diacritic-stripped) pass through published `red_flag_rules` in the target language and English before FAQ matching runs. Any hit immediately triggers a 5-second non-dismissable urgent clinic alert with `tel:` call links.
4. **Honest Uncertainty**: Queries below `MATCH_THRESHOLD` or within `0.03` of the runner-up return `unsure` with up to 3 spoken candidate questions.
5. **Strict Privacy (NDPA 2023)**: Voice audio is processed in memory and discarded immediately; `query_logs` stores zero audio, zero IPs, and zero device IDs.

---

## Quick Start (Local Demo)

### Option A: Two Terminals (Recommended for Dev)

**1. Backend API (`Python 3.11` + `FastAPI`)**
```powershell
cd backend
pip install -r requirements.txt
python -m scripts.seed --demo
python -m scripts.generate_audio --demo-synth --takes 2
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**2. Frontend PWA (`React` + `Vite` + `Tailwind CSS`)**
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:5173** in Chrome.

### Option B: Docker Compose

```powershell
docker compose up --build
```

---

## Batch YarnGPT Audio Generation (API or Colab GPU)

### Option 1: YarnGPT Hosted API (Recommended — No GPU or `ffmpeg` Needed)
1. Create an API key on [https://yarngpt.ai](https://yarngpt.ai) and add `YARNGPT_API_KEY=your_key` to `.env`.
2. Preview live voice IDs (`GET /api/v1/voices`) and generate Opus `.ogg` clips directly into `backend/static/audio/`:
```powershell
cd backend
python -m scripts.generate_audio --api --list-voices
python -m scripts.generate_audio --api --only-missing
```

### Option 2: Colab GPU (`saheedniyi/YarnGPT2b`)
1. Open [notebooks/generate_audio_colab.ipynb](notebooks/generate_audio_colab.ipynb) in Google Colab (T4/A100 GPU).
2. Run all cells to install `saheedniyi02/yarngpt` + `WavTokenizer`, synthesise approved translations into 24 kbps–32 kbps mono Opus `.ogg` clips, and download the zip into `backend/static/audio/`.
3. Run locally with `--only-missing` or `--lang yo --takes 2`.

---

## Testing & Evaluation

```powershell
# Backend tests (32 unit & integration tests)
cd backend
pytest -v

# Threshold sweep & accuracy evaluation
python -m scripts.evaluate --sweep

# Frontend tests (Vitest)
cd frontend
npm.cmd run test -- --run
```

---

## Documentation

- [DEMO.md](DEMO.md) — Live judge click-through script & offline fallback guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture & Mermaid flow diagram
- [docs/DATABASE.md](docs/DATABASE.md) — SQLModel schema & Mermaid ER diagram
- [docs/TESTING.md](docs/TESTING.md) — Automated test suite & privacy check commands
- [docs/TESTING_RESULTS.md](docs/TESTING_RESULTS.md) — Evaluation metrics & threshold sweep table
- [PRIVACY.md](PRIVACY.md) — Plain-language NDPA 2023 privacy summary
- [LICENSES.md](LICENSES.md) — Third-party models (`YarnGPT`, `Spitch`, `LaBSE`) & software credits
- [DECISIONS.md](DECISIONS.md) — Architectural decision log
- [PRODUCT.md](PRODUCT.md) & [DESIGN.md](DESIGN.md) — Product truth & Impeccable daylight design system

---

## Credits

- **YarnGPT (`saheedniyi/YarnGPT2b`)** by Saheed Azeez — Offline Nigerian-accented TTS
- **Spitch (`spitch`)** — Speech-to-Text for Yorùbá, Igbo, and English (`STTProvider`)
- **LaBSE (`sentence-transformers/LaBSE`)** & **RapidFuzz** — Multilingual matching
