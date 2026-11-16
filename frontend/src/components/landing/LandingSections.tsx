import React, { useState } from "react";
import { t } from "../../i18n";
import type { Lang } from "../../types";
import { BrandLogo, SoundWaveMotif, StepIllustration } from "../BrandSvg";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  LockIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
  TopicIcon,
  VolumeMutedIcon
} from "../Icons";

export interface LandingSectionsProps {
  lang: Lang;
  contentReviewed: boolean;
  sampleAudioByLang: Partial<Record<Lang, string | null>>;
  playingSampleLang: Lang | null;
  clinicalReviewers?: string;
  languageReviewers?: string;
  onSelectLang: (lang: Lang) => void;
  onOpenApp: (topicSlug?: string, view?: "home" | "about") => void;
  onToggleSampleLang: (targetLang: Lang) => void;
}

const TOPIC_CARDS: Array<{
  slug: string;
  icon: string;
  key: "topicMalaria" | "topicBp" | "topicOrs" | "topicPregnancy" | "topicMedicines";
}> = [
  { slug: "malaria", icon: "shield-plus", key: "topicMalaria" },
  { slug: "hypertension", icon: "heart-pulse", key: "topicBp" },
  { slug: "child_diarrhoea_ors", icon: "droplet", key: "topicOrs" },
  { slug: "pregnancy_danger_signs", icon: "baby", key: "topicPregnancy" },
  { slug: "safe_medicine_use", icon: "pill", key: "topicMedicines" }
];

const LANG_BUTTON_LABELS: Array<{
  code: Lang;
  key: "langCardYo" | "langCardPcm" | "langCardEn";
  chip: string;
}> = [
  { code: "yo", key: "langCardYo", chip: "Yorùbá" },
  { code: "pcm", key: "langCardPcm", chip: "Pidgin" },
  { code: "en", key: "langCardEn", chip: "English" }
];

const FAQ_KEYS: Array<{
  q: "faq1Q" | "faq2Q" | "faq3Q" | "faq4Q" | "faq5Q" | "faq6Q";
  a: "faq1A" | "faq2A" | "faq3A" | "faq4A" | "faq5A" | "faq6A";
}> = [
  { q: "faq1Q", a: "faq1A" },
  { q: "faq2Q", a: "faq2A" },
  { q: "faq3Q", a: "faq3A" },
  { q: "faq4Q", a: "faq4A" },
  { q: "faq5Q", a: "faq5A" },
  { q: "faq6Q", a: "faq6A" }
];

export const LandingSections: React.FC<LandingSectionsProps> = ({
  lang,
  contentReviewed,
  sampleAudioByLang,
  playingSampleLang,
  clinicalReviewers,
  languageReviewers,
  onSelectLang,
  onOpenApp,
  onToggleSampleLang
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      {/* Section A: The problem (Sand band) */}
      <section aria-labelledby="section-problem-heading" className="bg-hy-sand py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2
            id="section-problem-heading"
            className="text-2xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight mb-4 max-w-2xl"
          >
            {t(lang, "problemHeading")}
          </h2>
          <p className="text-hy-ink prose-measure text-base sm:text-lg leading-relaxed mb-9">
            {t(lang, "problemBody")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                num: t(lang, "stat1Num"),
                label: t(lang, "stat1Label"),
                src: t(lang, "stat1Source"),
                href: "https://www.health.gov.ng/"
              },
              {
                num: t(lang, "stat2Num"),
                label: t(lang, "stat2Label"),
                src: t(lang, "stat2Source"),
                href: "https://uis.unesco.org/en/country/ng"
              },
              {
                num: t(lang, "stat3Num"),
                label: t(lang, "stat3Label"),
                src: t(lang, "stat3Source"),
                href: "https://nationalnma.org/"
              }
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-seam rounded-card p-6 shadow-soft flex flex-col justify-between gap-4"
              >
                <div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-hy-green tabular-nums mb-2">
                    {item.num}
                  </p>
                  <p className="text-base font-medium text-hy-ink leading-snug">{item.label}</p>
                </div>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-hy-muted underline hover:text-hy-green self-start min-h-[24px]"
                >
                  {item.src}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section B: How it works (Kola Cream) */}
      <section aria-labelledby="section-how-heading" className="bg-hy-cream py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2
            id="section-how-heading"
            className="text-2xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight mb-9"
          >
            {t(lang, "howHeading")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([1, 2, 3] as const).map((stepNum) => (
              <article
                key={stepNum}
                className="bg-white border border-seam rounded-card p-5 shadow-soft flex flex-col gap-4"
              >
                <StepIllustration step={stepNum} />
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-hy-green text-white font-extrabold text-base flex items-center justify-center shrink-0 tabular-nums">
                    {stepNum}
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-hy-ink leading-snug mb-1.5">
                      {t(
                        lang,
                        stepNum === 1 ? "step1Title" : stepNum === 2 ? "step2Title" : "step3Title"
                      )}
                    </h3>
                    <p className="text-sm sm:text-base text-hy-muted leading-relaxed">
                      {t(
                        lang,
                        stepNum === 1 ? "step1Body" : stepNum === 2 ? "step2Body" : "step3Body"
                      )}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Section C: Safety (Leaf Green band, white text — Alert Red only in danger-sign callout) */}
      <section aria-labelledby="section-safety-heading" className="bg-hy-green text-white py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2
            id="section-safety-heading"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-4 max-w-2xl"
          >
            {t(lang, "safetyHeading")}
          </h2>
          <p className="text-hy-cream prose-measure text-base sm:text-lg leading-relaxed mb-3">
            {t(lang, "safetyBody")}
          </p>
          {!contentReviewed && (
            <p className="inline-block rounded-lg bg-hy-amber text-hy-ink text-sm font-bold px-3.5 py-2 mb-6">
              {t(lang, "trustDemo")} — {t(lang, "safetyBodyUnreviewed")}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-7 mb-8">
            <div className="rounded-card bg-hy-forest border border-white/15 p-6">
              <h3 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0" />
                <span>{t(lang, "safetyWillTitle")}</span>
              </h3>
              <ul className="space-y-3 text-hy-cream text-base">
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                  <span>{t(lang, "safetyWill1")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                  <span>{t(lang, "safetyWill2")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                  <span>{t(lang, "safetyWill3")}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-card bg-hy-forest border border-white/15 p-6">
              <h3 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-hy-cream shrink-0" />
                <span>{t(lang, "safetyWillNotTitle")}</span>
              </h3>
              <ul className="space-y-3 text-hy-cream text-base">
                <li>• {t(lang, "safetyWillNot1")}</li>
                <li>• {t(lang, "safetyWillNot2")}</li>
                <li>• {t(lang, "safetyWillNot3")}</li>
              </ul>
            </div>
          </div>

          {/* Only place on landing page where Alert Red appears */}
          <div
            role="note"
            className="rounded-card bg-hy-alert text-white p-6 flex items-start gap-4 shadow-soft"
          >
            <div className="w-11 h-11 rounded-xl bg-white text-hy-alert flex items-center justify-center shrink-0">
              <AlertTriangleIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold leading-snug mb-1">
                {t(lang, "dangerCalloutTitle")}
              </h3>
              <p className="text-base text-white leading-relaxed prose-measure">
                {t(lang, "dangerCalloutBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section D: Topics (Kola Cream; 5 two-colour icon cards) */}
      <section aria-labelledby="section-topics-heading" className="bg-hy-cream py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2
            id="section-topics-heading"
            className="text-2xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight mb-8"
          >
            {t(lang, "topicsBandHeading")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {TOPIC_CARDS.map((card) => (
              <button
                key={card.slug}
                type="button"
                onClick={() => onOpenApp(card.slug)}
                className="min-h-[120px] bg-white border border-seam rounded-card p-5 text-left shadow-soft hover:border-hy-green transition-colors flex flex-col justify-between gap-4"
              >
                <span className="w-14 h-14 rounded-card bg-hy-sand flex items-center justify-center shrink-0">
                  <TopicIcon icon={card.icon} className="w-8 h-8" />
                </span>
                <span className="font-extrabold text-base text-hy-ink leading-snug">
                  {t(lang, card.key)}
                </span>
              </button>
            ))}
          </div>

          <p className="text-sm font-semibold text-hy-muted mt-5">{t(lang, "topicsMore")}</p>
        </div>
      </section>

      {/* Section E: Languages (Sand band; three large audio cards) */}
      <section aria-labelledby="section-languages-heading" className="bg-hy-sand py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2
            id="section-languages-heading"
            className="text-2xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight mb-3"
          >
            {t(lang, "languagesHeading")}
          </h2>
          <p className="text-hy-ink prose-measure text-base sm:text-lg leading-relaxed mb-8">
            {t(lang, "languagesBody")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {LANG_BUTTON_LABELS.map((item) => {
              const clipUrl = sampleAudioByLang[item.code];
              const isPlaying = playingSampleLang === item.code;
              return (
                <div
                  key={item.code}
                  className="bg-white border border-seam rounded-card p-6 shadow-soft flex flex-col justify-between gap-5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-xl font-extrabold text-hy-ink">{t(lang, item.key)}</h3>
                      <span className="rounded-full bg-hy-sand px-3 py-1 text-xs font-bold text-hy-ink">
                        {item.chip}
                      </span>
                    </div>
                    <SoundWaveMotif active={isPlaying} color="#F5A623" className="w-full h-14" />
                  </div>

                  {clipUrl ? (
                    <button
                      type="button"
                      onClick={() => onToggleSampleLang(item.code)}
                      aria-label={`${
                        isPlaying ? t(lang, "langPauseCard") : t(lang, "langPlayCard")
                      } — ${item.chip}`}
                      className={`min-h-[48px] w-full px-4 py-3 rounded-full font-bold inline-flex items-center justify-center gap-2 transition-colors ${
                        isPlaying
                          ? "bg-hy-amber text-hy-ink"
                          : "bg-hy-green text-white hover:bg-hy-forest"
                      }`}
                    >
                      {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                      <span>{isPlaying ? t(lang, "langPauseCard") : t(lang, "langPlayCard")}</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section F: Privacy (Kola Cream) */}
      <section
        id="privacy"
        aria-labelledby="section-privacy-heading"
        className="bg-hy-cream py-14 sm:py-20"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2
            id="section-privacy-heading"
            className="text-2xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight mb-8"
          >
            {t(lang, "privacyHeading")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <LockIcon className="w-6 h-6 text-hy-green" />,
                title: t(lang, "privacyPoint1Title"),
                body: t(lang, "privacyPoint1Body")
              },
              {
                icon: <VolumeMutedIcon className="w-6 h-6 text-hy-green" />,
                title: t(lang, "privacyPoint2Title"),
                body: t(lang, "privacyPoint2Body")
              },
              {
                icon: <CheckCircleIcon className="w-6 h-6 text-hy-green" />,
                title: t(lang, "privacyPoint3Title"),
                body: t(lang, "privacyPoint3Body")
              }
            ].map((pt, idx) => (
              <div
                key={idx}
                className="bg-white border border-seam rounded-card p-6 shadow-soft flex flex-col gap-3"
              >
                <span className="w-11 h-11 rounded-card bg-hy-sand flex items-center justify-center">
                  {pt.icon}
                </span>
                <h3 className="text-lg font-extrabold text-hy-ink">{pt.title}</h3>
                <p className="text-base text-hy-muted leading-relaxed">{pt.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section G: For health workers and partners (Sand band) */}
      <section aria-labelledby="section-partners-heading" className="bg-hy-sand py-14 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h2
              id="section-partners-heading"
              className="text-2xl sm:text-3xl font-extrabold text-hy-ink tracking-tight leading-tight mb-3"
            >
              {t(lang, "partnersHeading")}
            </h2>
            <p className="text-base sm:text-lg text-hy-ink leading-relaxed prose-measure">
              {t(lang, "partnersBody")}
            </p>
          </div>

          <a
            href="mailto:partners@healthyarn.ng?subject=HealthYarn%20Partnership"
            className="min-h-[48px] px-7 py-3 rounded-full bg-hy-green text-white font-bold inline-flex items-center justify-center hover:bg-hy-forest transition-colors shrink-0"
          >
            {t(lang, "partnersBtn")}
          </a>
        </div>
      </section>

      {/* Section H: Questions people ask (Cream accordion) */}
      <section aria-labelledby="section-faq-heading" className="bg-hy-cream py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2
            id="section-faq-heading"
            className="text-2xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight mb-8"
          >
            {t(lang, "faqBandHeading")}
          </h2>

          <div className="space-y-3">
            {FAQ_KEYS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="bg-white border border-seam rounded-card overflow-hidden shadow-soft"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq((curr) => (curr === idx ? null : idx))}
                    className="w-full min-h-[56px] px-5 py-4 text-left flex items-center justify-between gap-4 font-extrabold text-base sm:text-lg text-hy-ink hover:bg-hy-sand/40 transition-colors"
                  >
                    <span>{t(lang, item.q)}</span>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-hy-green shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-base text-hy-muted leading-relaxed prose-measure border-t border-seam/60">
                      {t(lang, item.a)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section I: Closing call to action (Leaf Green, centred, large sound wave behind) */}
      <section className="relative bg-hy-green text-white py-16 sm:py-20 overflow-hidden text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
          <SoundWaveMotif color="#F5A623" className="w-full max-w-3xl h-56" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 flex flex-col items-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-3">
            {t(lang, "closingHeading")}
          </h2>
          <p className="text-lg sm:text-xl text-hy-cream mb-7">{t(lang, "closingSub")}</p>
          <button
            type="button"
            onClick={() => onOpenApp()}
            className="min-h-[52px] px-8 py-3.5 rounded-full bg-hy-amber text-hy-ink font-extrabold text-base sm:text-lg inline-flex items-center gap-2.5 shadow-lift hover:bg-amber-hover transition-colors"
          >
            <MicIcon className="w-5 h-5" />
            <span>{t(lang, "heroPrimaryBtn")}</span>
          </button>
        </div>
      </section>

      {/* Footer (Forest #0A3F33) */}
      <footer className="bg-hy-forest text-hy-cream py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/15">
            <div>
              <BrandLogo variant="onGreen" markSize="w-9 h-9" textSize="text-xl" />
              <p className="text-sm font-semibold text-hy-cream mt-2">
                {t(lang, "primaryTagline")}
              </p>
            </div>

            <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenApp(undefined, "about")}
                className="min-h-[48px] px-3 text-sm font-semibold text-hy-cream hover:text-white underline"
              >
                {t(lang, "aboutLink")}
              </button>
              <a
                href="#privacy"
                className="min-h-[48px] px-3 inline-flex items-center text-sm font-semibold text-hy-cream hover:text-white underline"
              >
                {t(lang, "footerPrivacyLink")}
              </a>
              <a
                href="mailto:partners@healthyarn.ng?subject=HealthYarn%20Contact"
                className="min-h-[48px] px-3 inline-flex items-center text-sm font-semibold text-hy-cream hover:text-white underline"
              >
                {t(lang, "footerContactLink")}
              </a>
              <button
                type="button"
                onClick={() => onOpenApp()}
                className="min-h-[48px] px-4 rounded-full bg-hy-green text-white text-sm font-bold hover:bg-white hover:text-hy-forest transition-colors"
              >
                {t(lang, "navOpenApp")}
              </button>
            </nav>

            <div
              className="inline-flex items-center rounded-full bg-hy-green p-1 self-start"
              role="group"
              aria-label={t(lang, "langSwitchLabel")}
            >
              {(["en", "pcm", "yo"] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectLang(code)}
                  aria-pressed={lang === code}
                  className={`min-h-[44px] px-3.5 rounded-full text-xs font-bold transition-colors ${
                    lang === code
                      ? "bg-hy-amber text-hy-ink"
                      : "text-hy-cream hover:text-white"
                  }`}
                >
                  {code === "en" ? "English" : code === "pcm" ? "Pidgin" : "Yorùbá"}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-2 text-xs sm:text-sm text-hy-cream/90">
            <p>{t(lang, "footerDisclaimer")}</p>
            <p className="font-semibold">{t(lang, "footerCredits")}</p>
            {clinicalReviewers && languageReviewers && contentReviewed && (
              <p className="text-xs text-hy-cream/80">
                {t(lang, "aboutClinicalReview")}: {clinicalReviewers} ·{" "}
                {t(lang, "aboutLanguageReview")}: {languageReviewers}
              </p>
            )}
          </div>
        </div>
      </footer>
    </>
  );
};

export default LandingSections;
