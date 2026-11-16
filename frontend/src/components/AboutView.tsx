import React from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { BrandLogo } from "./BrandSvg";
import { SiteHeader, type NavRoute } from "./SiteHeader";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LockIcon,
  MicIcon,
  ShieldCheckIcon
} from "./Icons";

interface AboutViewProps {
  lang: Lang;
  meta: {
    content_last_updated: string;
    clinical_reviewers: string;
    language_reviewers: string;
  };
  onSelectLang: (lang: Lang) => void;
  onNavigateRoute: (route: NavRoute) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  lang,
  meta,
  onSelectLang,
  onNavigateRoute
}) => {
  return (
    <div className="min-h-screen bg-hy-cream text-hy-ink flex flex-col">
      <SiteHeader
        activeRoute="about"
        lang={lang}
        onSelectLang={onSelectLang}
        onNavigate={onNavigateRoute}
      />

      <main className="flex-1">
        {/* Intro Band */}
        <section className="bg-hy-sand border-b border-seam py-10 sm:py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="mb-4">
              <BrandLogo variant="brand" markSize="w-9 h-9" textSize="text-xl" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-hy-ink tracking-tight leading-tight mb-4 max-w-2xl">
              {t(lang, "aboutTitle")}
            </h1>
            <p className="text-lg text-hy-ink prose-measure leading-relaxed mb-3">
              {t(lang, "aboutWhatItDoes")}
            </p>
            <p className="text-base text-hy-muted prose-measure leading-relaxed mb-8">
              {t(lang, "aboutWhatItDoesNot")}
            </p>

            <h2 className="text-sm font-extrabold uppercase tracking-wider text-hy-green mb-4">
              {t(lang, "aboutPillarsTitle")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: t(lang, "aboutPillar1Title"),
                  body: t(lang, "aboutPillar1Body")
                },
                {
                  title: t(lang, "aboutPillar2Title"),
                  body: t(lang, "aboutPillar2Body")
                },
                {
                  title: t(lang, "aboutPillar3Title"),
                  body: t(lang, "aboutPillar3Body")
                }
              ].map((pillar, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-seam rounded-card p-5 shadow-soft"
                >
                  <h3 className="text-lg font-extrabold text-hy-ink mb-1.5">{pillar.title}</h3>
                  <p className="text-sm sm:text-base text-hy-muted leading-relaxed">
                    {pillar.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Will / Will Not Boundaries */}
        <section className="bg-hy-cream py-10 sm:py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-hy-green text-white rounded-card p-6 shadow-soft">
                <h2 className="text-lg font-extrabold mb-3 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0" />
                  <span>{t(lang, "safetyWillTitle")}</span>
                </h2>
                <ul className="space-y-2.5 text-hy-cream text-base">
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

              <div className="bg-white border border-seam rounded-card p-6 shadow-soft">
                <h2 className="text-lg font-extrabold text-hy-ink mb-3 flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-hy-green shrink-0" />
                  <span>{t(lang, "safetyWillNotTitle")}</span>
                </h2>
                <ul className="space-y-2.5 text-hy-muted text-base">
                  <li>• {t(lang, "safetyWillNot1")}</li>
                  <li>• {t(lang, "safetyWillNot2")}</li>
                  <li>• {t(lang, "safetyWillNot3")}</li>
                </ul>
              </div>
            </div>

            <div
              role="note"
              className="rounded-card bg-hy-alert text-white p-5 flex items-start gap-4 shadow-soft"
            >
              <span className="w-10 h-10 rounded-xl bg-white text-hy-alert flex items-center justify-center shrink-0">
                <AlertTriangleIcon className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold mb-1">{t(lang, "dangerCalloutTitle")}</h3>
                <p className="text-sm sm:text-base text-white leading-relaxed prose-measure">
                  {t(lang, "dangerCalloutBody")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4-Step Human Review Pipeline + Reviewer Sign-Off */}
        <section className="bg-hy-sand py-10 sm:py-14 border-y border-seam">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-hy-ink mb-4">
                {t(lang, "aboutPipelineHeading")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  t(lang, "aboutStage1"),
                  t(lang, "aboutStage2"),
                  t(lang, "aboutStage3"),
                  t(lang, "aboutStage4")
                ].map((stage, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-seam rounded-card p-4 font-bold text-sm sm:text-base text-hy-ink shadow-soft"
                  >
                    {stage}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Review & Updates Card */}
              <div className="bg-white border border-seam rounded-card p-6 shadow-soft">
                <h2 className="text-lg font-extrabold text-hy-ink mb-4">
                  {t(lang, "aboutReviewersHeading")}
                </h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 pb-2 border-b border-seam">
                    <dt className="font-semibold text-hy-muted">
                      {t(lang, "aboutClinicalReview")}
                    </dt>
                    <dd className="font-bold text-hy-ink">{meta.clinical_reviewers}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 pb-2 border-b border-seam">
                    <dt className="font-semibold text-hy-muted">
                      {t(lang, "aboutLanguageReview")}
                    </dt>
                    <dd className="font-bold text-hy-ink">{meta.language_reviewers}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="font-semibold text-hy-muted">{t(lang, "aboutLastUpdated")}</dt>
                    <dd className="font-bold text-hy-ink tabular-nums">
                      {meta.content_last_updated || "2026-11-16"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Privacy & Voice Stack Credits Card */}
              <div className="bg-white border border-seam rounded-card p-6 shadow-soft space-y-4">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-hy-sand text-hy-green flex items-center justify-center shrink-0">
                    <LockIcon className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold text-hy-ink mb-1">
                      {t(lang, "aboutCreditsHeading")}
                    </h2>
                    <p className="text-sm text-hy-muted leading-relaxed">
                      {t(lang, "aboutPrivacySummary")}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-hy-green mb-2">
                    {t(lang, "aboutStackHeading")}
                  </h3>
                  <ul className="space-y-1.5 text-sm text-hy-ink">
                    <li>
                      <span className="font-bold">Spitch Speech AI:</span> Speech-to-Text &amp;
                      Nigerian TTS voices (sade, ufoma, remi)
                    </li>
                    <li>
                      <span className="font-bold">YarnGPT (Saheed Azeez):</span> Nigerian-accented
                      Text-to-Speech synthesis (idera) &amp; YarnGPT2b
                    </li>
                    <li>
                      <span className="font-bold">LaBSE &amp; RapidFuzz:</span> Multilingual FAQ
                      matching &amp; diacritic normalisation
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateRoute("app")}
                className="min-h-[48px] px-6 py-3 rounded-full bg-hy-amber text-hy-ink font-extrabold inline-flex items-center gap-2 shadow-soft hover:bg-amber-hover transition-colors"
              >
                <MicIcon className="w-5 h-5" />
                <span>{t(lang, "navVoiceApp")}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateRoute("landing")}
                className="min-h-[48px] px-6 py-3 rounded-full bg-white border border-hy-green text-hy-green font-bold hover:bg-viridian-soft transition-colors"
              >
                {t(lang, "navOverview")}
              </button>
              <button
                type="button"
                onClick={() => onNavigateRoute("admin")}
                className="min-h-[48px] px-5 py-3 rounded-full text-hy-green font-bold hover:underline"
              >
                {t(lang, "navStaff")} →
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
