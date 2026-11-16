---
name: HealthYarn
description: Nigerian Primary Health Centre (PHC) daylight triage visual system for voice-first multilingual health guidance.
colors:
  hy-green: "#0f5c4a"
  hy-green-deep: "#0a3f33"
  hy-amber: "#f5a623"
  hy-cream: "#fff8ec"
  hy-sand: "#f1e6d2"
  hy-ink: "#1b1f1d"
  hy-muted: "#5b655f"
  hy-alert: "#c8322b"
  viridian-soft: "#e4f1ed"
  reading-plate: "#ffffff"
  seam: "#e2d4bc"
typography:
  headline:
    fontFamily: '"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: '"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: '"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-viridian}"
    textColor: "{colors.reading-plate}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    height: "48px"
  button-mic-trigger:
    backgroundColor: "{colors.primary-viridian}"
    textColor: "{colors.reading-plate}"
    rounded: "{rounded.full}"
    size: "144px"
  surface-plate:
    backgroundColor: "{colors.reading-plate}"
    rounded: "{rounded.lg}"
    padding: "24px"
  alert-red-flag:
    backgroundColor: "{colors.clinical-crimson}"
    textColor: "{colors.reading-plate}"
    padding: "24px"
---

# Design System: HealthYarn

## Overview

**Creative North Star: "Nigerian Primary Health Centre Daylight Triage"**

HealthYarn is designed for outdoor daylight viewing on entry-level Android phones (`2 GB` RAM, Chrome) used by Yorùbá-, Nigerian Pidgin-, and English-speaking adults across Nigeria. Rather than dark-mode chatbots or marketing-style card grids, the interface uses a warm Kola Cream (`#FFF8EC`) & Sand (`#F1E6D2`) canvas, crisp white reading plates, deep Leaf Green (`#0F5C4A`) primary structure, and Sunrise Amber (`#F5A623` paired with Ink `#1B1F1D`) for primary voice focus.

**Key Characteristics:**
- Warm Kola Cream & Sand surfaces with high contrast (Ink `#1B1F1D` > 15:1 on Kola Cream)
- Quarantined semantic state colors: Leaf Green for guidance & trusted actions, Sunrise Amber for one primary voice focus per view, Alert Red (`#C8322B`) reserved strictly for danger-sign messaging
- Self-hosted unified `Noto Sans` (`noto-sans-hy.woff2`, `74.5 KB`, `400..800`) so Yorùbá diacritics and sub-dots render reliably offline
- Dual-coded voice, icon, and text controls at `>= 48px` touch size

## Colors

Colors carry strict clinical and operational meaning so low-literacy visitors immediately recognize safe actions versus urgent danger states.

### Primary
- **Primary Viridian** (`#0f523b`): Top utility rail, primary microphone trigger, replay action, and confirmed focus states.
- **Primary Viridian Hover** (`#0b3f2d`): Pressed/hover state and top rail bottom seam.
- **Viridian Soft** (`#e4f0ea`): Tinted selection surface for active topic icons, primed unsure cards, and positive feedback states.

### Secondary
- **Amber Ochre** (`#92400e`) & **Amber Surface** (`#fef3c7`): Non-reviewed demo content banner, offline mode notice, and unsure fallback hint.
- **Clinical Crimson** (`#b91c1c`) & **Crimson Deep** (`#7f1d1d`): Exclusively reserved for the full-screen urgent Red-Flag danger alert and clinic call buttons.

### Neutral
- **Sunlit Ground** (`#f7f6f2`): Primary warm daylight backdrop across all non-emergency views.
- **Reading Plate** (`#ffffff`): High-legibility reading surface for answers, language cards, and topic rows.
- **Subtle Layer** (`#efece4`): Status bar, privacy disclaimer callouts, and table headers.
- **Limestone Seam** (`#d6d3c9`): Crisp `1px` structural borders separating plates without heavy drop shadows.
- **Slate Ink** (`#141f1a`) & **Muted Viridian Ink** (`#415249`): Body and secondary copy tinted from the viridian-slate hue rather than flat neutral gray.

### Named Rules
**The Crimson Quarantine Rule.** Clinical Crimson (`#b91c1c`) never appears on resting buttons, badges, or decoration; it owns the entire screen only when a red-flag rule fires.

**The No-Kicker Rule.** Headings stand on their own weight without eyebrow or kicker labels above them.

## Typography

**Body & Display Font:** `"Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (zero-latency local system/Android stack with full Yorùbá and Igbo combining diacritic support).

**Character:** Calm, legible humanist sans-serif at an `18px` (`1.125rem`) root `html` scale so every rem step scales comfortably for low-vision and low-literacy reading.

### Hierarchy
- **Headline** (`700`, `1.5rem`, `line-height: 1.25`): Screen titles (`LanguagePicker`, `AnswerView`, `RedFlagAlertView`) with `text-wrap: balance`.
- **Title** (`700`, `1.25rem`, `line-height: 1.3`): Topic rows and section headings.
- **Body** (`400`, `1rem` = `18px`, `line-height: 1.55`): Answer prose constrained to `68ch` (`max-width: 68ch`).
- **Label / Tabular** (`700`, `0.75rem`, `font-variant-numeric: tabular-nums`): Recording countdowns, red-flag 5-second safety timer, language chips, and stats tables.

## Layout

Single-column mobile-first stream (`max-w-2xl` / `42rem` centered container) beneath a `56px` utility rail, preventing horizontal overflow on `390px` Android screens while preserving generous `68ch` reading measure on `1440px` desktops.

## Elevation & Depth

Surfaces rely primarily on tonal separation (`#f7f6f2` ground vs `#ffffff` reading plates) and `1px` limestone seams (`#d6d3c9`), keeping subtle elevation (`shadow-sm` / `shadow-md`) exclusively for the central microphone trigger and primary card plates.

## Shapes

Consistent `8px` (`rounded-lg`) for interactive buttons/inputs, `12px`–`16px` (`rounded-xl` / `rounded-2xl`) for reading plates and list cards, and `9999px` (`rounded-full`) reserved exclusively for the central tactile microphone trigger and status badges.

## Components

### Buttons
- **Shape:** Gently rounded (`8px` radius) or full circular (`9999px`) for the microphone trigger, minimum `48px × 48px` target size.
- **Primary:** Primary Viridian (`#0f523b`) fill with pure white text (`#ffffff`) and Viridian Hover (`#0b3f2d`) on interaction; visible `3px solid #0f523b` focus-visible ring.

### Cards / Reading Plates
- **Corner Style:** `12px`–`16px` radius, `1px solid #d6d3c9` border, zero asymmetric `>1px` colored left/right accents.

### Navigation & Browser Surfaces
- `::selection` uses `#0f523b` background with `#ffffff` text; custom scrollbars and `caret-color` align with `#0f523b` and `#efece4`.

## Do's and Don'ts

### Do:
- **Do** preserve `18px` root typography and `>= 48px` touch targets across every public control.
- **Do** keep consistent `strokeWidth={2}` SVG icons beside spoken audio buttons for low-literacy users.
- **Do** respect `prefers-reduced-motion` and provide an explicit autoplay mute toggle in the top header.

### Don't:
- **Don't** add eyebrow/kicker text above headings, gradient text, decorative glass blur, or emojis standing in for UI icons.
- **Don't** use Clinical Crimson (`#b91c1c`) outside urgent Red-Flag alerts or destructive rejection controls in `/admin`.
