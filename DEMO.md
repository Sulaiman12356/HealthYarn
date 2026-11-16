# HealthYarn Judge Demo Script (`DEMO.md`)

Follow this step-by-step script for the **ITDC 2026** live demonstration (plus offline/network fallback steps).

## 1. Quick Start (Local Demo)

```powershell
# Terminal 1 — Backend API (from backend/)
cd backend
python -m scripts.seed --demo
python -m scripts.generate_audio --demo-synth --takes 2
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend PWA (from frontend/)
cd frontend
npm.cmd run dev
```

Or run the entire stack with Docker:
```powershell
docker compose up --build
```

Open **http://localhost:5173** in Chrome (ideally with DevTools Mobile Device Toolbar at `390×844` + "Slow 3G" network throttle).

---

## 2. Live Click-Through Script (3–4 Minutes)

1. **Welcome, Spoken Prompts & Privacy Consent**
   - Observe the three large language buttons: **Yorùbá**, **Igbo**, **English**.
   - Tap the speaker icon beside Yorùbá or English to hear the welcome audio clip, and tap **"Listen to privacy notice"** to confirm the spoken NDPA promise (*"Your voice is used only to understand your question and is not saved"*).
   - Select **English** (or **Yorùbá**). Note the visible **"DEMO CONTENT — NOT CLINICALLY REVIEWED"** banner indicating `--demo` seeded placeholder copy.

2. **Tap-a-Topic Flow & Offline Resilience (No Wi-Fi Needed)**
   - Confirm the status bar shows **"Ready to use offline"**.
   - In Chrome DevTools → **Network**, switch throttling to **Offline**.
   - Observe the microphone card switches automatically to **"Voice needs internet — browse topics below"**.
   - Tap **Child Diarrhoea & ORS** → tap a row's speaker button to preview the question audio → open the answer.
   - Verify the answer plays, automatically chains the **Safety notice (disclaimer)** clip, supports **0.75× slow** playback, and works completely offline.

3. **Voice Flow + Hybrid Matching (`MockSTT` or Live `Spitch`)**
   - Switch Chrome DevTools back to **Online** (or **Slow 3G**).
   - **Normal Answer**: Hold the mic button (or switch to tap-to-speak mode) and say *"How do I mix ORS for my child?"* (or type in the test bar when on a laptop without mic permission: `"how to mix ors"`). Verify it returns the exact ORS preparation answer + chained disclaimer + thumbs up/down feedback.
   - **Unsure Disambiguation**: Ask `"What is the price of tomatoes in Mile 12 market?"` → observe the **Unsure** screen offering 3 candidate questions with audio preview on 1st tap and answer open on 2nd tap.
   - **Red-Flag Safety Gate**: Ask `"My child is having convulsions"` (or in Yorùbá without diacritics: `"Omo mi n se giri bayi"`). Observe immediate transition to the full-screen **Urgent Medical Danger Sign** screen, clinic `tel:` call links, and the **5-second non-dismissable safety lock** countdown.

4. **Staff Content Governance Portal (`/admin`)**
   - Click **Staff** in the top header (or navigate to `/admin`).
   - Sign in with any demo account created by `seed.py --demo`:
     - Editor: `editor@healthyarn.ng` / `HealthYarnEditor2026!`
     - Clinical Reviewer: `clinical@healthyarn.ng` / `HealthYarnClinic2026!`
     - Language Reviewer: `language@healthyarn.ng` / `HealthYarnLang2026!`
     - Admin: `admin@healthyarn.ng` / `HealthYarnAdmin2026!`
   - Show that editing resets status to `draft`, Clinical Reviewer must approve English before Language Reviewer approves translations, Admin cannot publish `[PLACEHOLDER – NOT REVIEWED]` text, and every action writes to the **Stats & Audit** log.

---

## 3. Offline / Network Failure Fallback

- If conference Wi-Fi fails or `SPITCH_API_KEY` is unavailable:
  1. Ensure `STT_PROVIDER=mock` in `.env` — the voice mic button works 100% locally via `MockSTT`!
  2. All 5 topics, 20 questions, and 198 audio clips remain cached inside the browser PWA even with Wi-Fi completely turned off.
