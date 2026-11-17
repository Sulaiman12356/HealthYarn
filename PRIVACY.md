# Privacy Notice (`PRIVACY.md`) — HealthYarn

HealthYarn is built on strict data minimisation aligned with the **Nigeria Data Protection Act (NDPA) 2023**.

## What We Process — And What We Never Store

1. **Voice Recordings (Public Users)**
   - When you hold or tap the microphone button, your browser records up to 15 seconds of audio and sends it to `/api/ask` over HTTPS/HTTP.
   - The server transcribes the audio **strictly in memory** and deletes the audio buffer (`del audio_bytes`) immediately after transcription.
   - Voice recordings are **never saved to disk, never written to databases, and never logged**.

2. **Public User Accounts & Tracking**
   - Public users do **not** create accounts, sign in, or receive tracking cookies.
   - HealthYarn includes **zero third-party analytics SDKs, ad trackers, or external font tracking beacons**.
   - Your chosen language (`yo`, `pcm`, `en`), autoplay preference, and offline topic bundle are saved locally on your own device (`localStorage` and Browser Cache Storage).

3. **Anonymous Query Logs (`query_logs`)**
   - Each query records only: language (`yo`/`pcm`/`en`), input mode (`voice`/`tap`), matched FAQ ID (if any), similarity score, outcome (`answer`/`unsure`/`red_flag`/`error`), optional thumbs rating (`1` or `-1`), and timestamp.
   - `query_logs` **never** stores IP addresses, device IDs, phone numbers, user names, or audio files.
   - By default (`LOG_UNMATCHED_TEXT=false`), not even the transcribed text of `unsure` queries is stored.

4. **Rate Limiting**
   - Request rate limits (`20/minute` on `/api/ask`, `5/minute` on `/api/admin/login`) use transient in-memory counters only and are never written to disk or databases.

5. **Staff Portal (`/admin`)**
   - Authentication uses an `httpOnly`, `SameSite=Lax` JWT cookie (8-hour expiry) and CSRF token for verified clinical/language reviewers and administrators only.
   - Content approvals, rejections, and publishes are recorded in `audit_log` for clinical accountability.
