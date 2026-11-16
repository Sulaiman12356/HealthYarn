---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

# Surface Brief — HealthYarn Public & Staff Web App (`frontend/src/App.tsx`)

- **Mode**: `operate` (code-led)
- **Audience**: Yorùbá-, Igbo-, and English-speaking Nigerian adults with varying literacy on low-end Android phones outdoors/on 3G, plus clinic/review staff on `/admin`.
- **Job**: Ask a health question by voice or browse 5 core health topics completely offline, hear a verified Nigerian-voice audio answer + safety disclaimer, and immediately receive clinic-call guidance on red-flag symptoms.

## Direction contract

THESIS: A Nigerian Primary Health Centre (PHC) daylight triage surface that treats spoken audio, crisp iconography, and high-contrast readable text as co-equal channels, refusing generic dark-mode chatbots and decorative multi-card marketing layouts.

OWN-WORLD: Sunlit plaster ground (`#F7F6F2`) paired with crisp white reading plates (`#FFFFFF`) and 1px limestone seams (`#D6D3C9`) engineered for harsh outdoor LCD glare; deep PHC viridian (`#0F523B`) reserved exclusively for the header rail and primary voice/confirm actions; amber-ochre (`#B45309`) for uncertain/offline notices; and clinical crimson (`#B91C1C`) quarantined strictly to the full-screen Red-Flag danger alert. Typography uses a single workhorse humanist sans stack (`"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for instant zero-latency offline loading and crisp Yorùbá/Igbo diacritic rendering: `ọ`, `ẹ`, `ṣ`, `ị`, `ụ`, `ṅ`) at an `18px` (`1.125rem`) fixed `rem` scale with `tabular-nums` for countdowns and stats.

STORY: On first visit, the user hears and selects Yorùbá, Igbo, or English alongside a clear voice-privacy promise; on Home, they hold one central tactile microphone trigger (or tap to start/stop) or pick one of 5 offline-ready topics below; every answer plays immediately in a Nigerian voice followed by a safety disclaimer, while any red-flag keyword locks the screen into a 5-second non-dismissable clinic-call alert.

FIRST VIEWPORT: Top utility rail (`#0F523B`, 56px height) carrying the HealthYarn emblem, active language switcher pill (`YO | IG | EN`), offline readiness pill, and subtle About/Staff links; immediately below (when active) a high-contrast `DEMO CONTENT` safety strip; center stage dominated by the oversized circular Hold-to-Speak microphone button (`144×144px` tactile target with concentric live-volume ring and `tabular-nums` 15s countdown), paired with an accessible Tap-to-Speak toggle; lower fold displaying the 5 single-column topic rows (`>= 64px` touch height each) with uniform-stroke SVG icons and right-hand audio/chevron affordances. Signature move: the **Dual-Mode Triage Ring & Chained Disclaimer Bar**, where recording/playback state drives a live tabular timeline and automatically chains the spoken safety disclaimer clip after every answer.

FORM: Candidate 4 ("Nigerian PHC Daylight Triage Desk") from the 7-direction grounded list (`seed:18a533a2efee3fba`). Raised by `rw-lexicon-shoulder-and-plate` (strict color quarantine on reading panes), `vernacular-ephemera-boarding-pass-and-gate-board` (persistent red-flag holding state + tabular numerals), and `digital-design-canon-dark-first-developer-console` (deliberate physical isolation around destructive/cancel controls with 1px seams).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
