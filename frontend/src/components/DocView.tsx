import React from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { ABOUT_CONFIG } from "../config/aboutConfig";
import { ArrowLeftIcon } from "./Icons";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader, type NavRoute } from "./SiteHeader";

interface DocViewProps {
  doc: "privacy" | "credits";
  lang: Lang;
  contentReviewed: boolean;
  clinicalReviewers?: string;
  languageReviewers?: string;
  onSelectLang: (lang: Lang) => void;
  onNavigateRoute: (route: NavRoute) => void;
}

export const DocView: React.FC<DocViewProps> = ({
  doc,
  lang,
  contentReviewed,
  clinicalReviewers,
  languageReviewers,
  onSelectLang,
  onNavigateRoute
}) => {
  const isPrivacy = doc === "privacy";

  return (
    <div className="min-h-screen bg-hy-cream text-hy-ink flex flex-col">
      <SiteHeader
        activeRoute={isPrivacy ? "privacy" : "credits"}
        lang={lang}
        onSelectLang={onSelectLang}
        onNavigate={onNavigateRoute}
      />

      <main className="flex-1 py-10 sm:py-14">
        <article className="max-w-[720px] mx-auto px-4 sm:px-6 space-y-8">
          <div>
            <button
              type="button"
              onClick={() => onNavigateRoute("about")}
              className="min-h-[48px] px-4 py-2 rounded-full bg-white border border-seam text-sm font-bold text-hy-green inline-flex items-center gap-2 hover:bg-hy-sand transition-colors mb-5"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>{t(lang, "docBackAbout")}</span>
            </button>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-hy-ink tracking-tight leading-tight">
              {isPrivacy ? t(lang, "privacyDocTitle") : t(lang, "creditsDocTitle")}
            </h1>
          </div>

          {isPrivacy ? (
            <div className="bg-white border border-seam rounded-card p-6 sm:p-8 shadow-soft space-y-6 text-base leading-relaxed">
              <p>
                HealthYarn is built on strict data minimisation aligned with the{" "}
                <strong>Nigeria Data Protection Act (NDPA) 2023</strong>.
              </p>

              <section className="space-y-2">
                <h2 className="text-xl font-extrabold text-hy-ink">
                  1. Voice Recordings (Public Users)
                </h2>
                <ul className="list-disc pl-5 space-y-1.5 text-hy-muted">
                  <li>
                    When you hold or tap the microphone button, your browser records up to 15
                    seconds of audio and sends it to <code className="text-hy-ink">/api/ask</code>.
                  </li>
                  <li>
                    The server transcribes the audio strictly in memory and deletes the audio buffer
                    immediately after transcription.
                  </li>
                  <li>
                    Voice recordings are never saved to disk, never written to databases, and never
                    logged.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-extrabold text-hy-ink">
                  2. Public User Accounts &amp; Tracking
                </h2>
                <ul className="list-disc pl-5 space-y-1.5 text-hy-muted">
                  <li>
                    Public users do not create accounts, sign in, or receive tracking cookies.
                  </li>
                  <li>
                    HealthYarn includes zero third-party analytics SDKs, ad trackers, or external
                    font tracking beacons.
                  </li>
                  <li>
                    Your chosen language (<code className="text-hy-ink">yo</code>,{" "}
                    <code className="text-hy-ink">pcm</code>,{" "}
                    <code className="text-hy-ink">en</code>), autoplay preference, and offline topic
                    bundle are saved locally on your own device.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-extrabold text-hy-ink">
                  3. Anonymous Query Logs (Topic Counts Only)
                </h2>
                <ul className="list-disc pl-5 space-y-1.5 text-hy-muted">
                  <li>
                    Each query records only language, input mode, matched FAQ ID (if any),
                    similarity score, outcome, optional helpfulness rating, and timestamp.
                  </li>
                  <li>
                    Logs never store IP addresses, device IDs, phone numbers, user names, or audio
                    files, and unmatched transcripts are not saved by default.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-extrabold text-hy-ink">
                  4. Staff Governance Portal (/admin)
                </h2>
                <p className="text-hy-muted">
                  Staff sign-in uses an <code className="text-hy-ink">httpOnly</code>,{" "}
                  <code className="text-hy-ink">SameSite=Lax</code> JWT cookie and CSRF token for
                  clinical reviewers, language reviewers, editors, and administrators only.
                </p>
              </section>
            </div>
          ) : (
            <div className="bg-white border border-seam rounded-card p-6 sm:p-8 shadow-soft space-y-6 text-base leading-relaxed">
              <p className="text-hy-muted">
                HealthYarn respectfully credits the following open-source models, speech services,
                health guidance, and software libraries (<code className="text-hy-ink">LICENSES.md</code>).
              </p>

              <section className="space-y-2.5">
                <h2 className="text-xl font-extrabold text-hy-ink">AI Models &amp; Speech Services</h2>
                <ul className="list-disc pl-5 space-y-2 text-hy-muted">
                  <li>
                    <strong className="text-hy-ink">YarnGPT (Saheed Azeez / saheedniyi02):</strong>{" "}
                    Nigerian Speech-to-Text (<code className="text-hy-ink">/api/v1/asr</code>) and
                    offline batch Nigerian-accented Text-to-Speech synthesis (
                    <code className="text-hy-ink">YarnGPT2b</code>, Apache-2.0 / model terms).
                  </li>
                  <li>
                    <strong className="text-hy-ink">Spitch Speech AI (spitch):</strong>{" "}
                    West African Speech-to-Text (<code className="text-hy-ink">STTProvider</code>{" "}
                    fallback) and native Nigerian TTS voices (<code className="text-hy-ink">sade</code>,{" "}
                    <code className="text-hy-ink">ufoma</code>,{" "}
                    <code className="text-hy-ink">remi</code>) via the MIT Python SDK.
                  </li>
                  <li>
                    <strong className="text-hy-ink">
                      LaBSE (sentence-transformers/LaBSE):
                    </strong>{" "}
                    Language-agnostic BERT Sentence Embedding model (Apache-2.0).
                  </li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-xl font-extrabold text-hy-ink">Clinical Source Material</h2>
                <p className="text-hy-muted">
                  Educational health content is adapted from public{" "}
                  <strong className="text-hy-ink">World Health Organization (WHO)</strong> and{" "}
                  <strong className="text-hy-ink">
                    Nigeria Federal Ministry of Health (FMOH)
                  </strong>{" "}
                  primary health care guidance.
                </p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-xl font-extrabold text-hy-ink">
                  Backend &amp; Frontend Software
                </h2>
                <ul className="list-disc pl-5 space-y-1.5 text-hy-muted">
                  <li>
                    <strong className="text-hy-ink">Backend:</strong> FastAPI (MIT), Uvicorn
                    (BSD-3-Clause), SQLModel &amp; SQLAlchemy (MIT), RapidFuzz (MIT), scikit-learn
                    (BSD-3-Clause), NumPy (BSD-3-Clause), SlowAPI (MIT), bcrypt (Apache-2.0), PyJWT
                    (MIT).
                  </li>
                  <li>
                    <strong className="text-hy-ink">Frontend:</strong> React &amp; React DOM (MIT),
                    Vite (MIT), TypeScript (Apache-2.0), Tailwind CSS (MIT), vite-plugin-pwa &amp;
                    Workbox (MIT), Noto Sans (SIL Open Font License 1.1).
                  </li>
                </ul>
              </section>
            </div>
          )}
        </article>
      </main>

      <SiteFooter
        lang={lang}
        contentReviewed={contentReviewed}
        clinicalReviewers={clinicalReviewers}
        languageReviewers={languageReviewers}
        contactEmail={ABOUT_CONFIG.contactEmail}
        onSelectLang={onSelectLang}
        onOpenApp={() => onNavigateRoute("app")}
        onNavigateRoute={onNavigateRoute}
      />
    </div>
  );
};
