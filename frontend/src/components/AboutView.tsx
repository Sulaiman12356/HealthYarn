import React from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { ArrowLeftIcon } from "./Icons";

interface AboutViewProps {
  lang: Lang;
  meta: {
    content_last_updated: string;
    clinical_reviewers: string;
    language_reviewers: string;
  };
  onBack: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ lang, meta, onBack }) => {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        aria-label={t(lang, "backHome")}
        className="min-h-[48px] px-4 py-2 rounded-lg bg-surface border border-seam text-ink font-semibold inline-flex items-center gap-2 hover:bg-subtle transition-colors mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5 text-viridian" />
        <span>{t(lang, "backHome")}</span>
      </button>

      <div className="bg-surface border border-seam rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <h1 className="text-2xl font-bold text-ink">{t(lang, "aboutTitle")}</h1>

        <p className="text-base text-ink prose-measure">{t(lang, "aboutWhatItDoes")}</p>
        <p className="text-base text-ink-muted prose-measure">{t(lang, "aboutWhatItDoesNot")}</p>

        <section className="pt-4 border-t border-seam">
          <h2 className="text-lg font-bold text-ink mb-3">{t(lang, "aboutReviewersHeading")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-1 border-b border-seam">
              <dt className="font-semibold text-ink-muted">{t(lang, "aboutClinicalReview")}</dt>
              <dd className="text-ink">{meta.clinical_reviewers}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-1 border-b border-seam">
              <dt className="font-semibold text-ink-muted">{t(lang, "aboutLanguageReview")}</dt>
              <dd className="text-ink">{meta.language_reviewers}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-1">
              <dt className="font-semibold text-ink-muted">{t(lang, "aboutLastUpdated")}</dt>
              <dd className="text-ink tabular-nums">{meta.content_last_updated || "2026-11-16"}</dd>
            </div>
          </dl>
        </section>

        <section className="pt-4 border-t border-seam">
          <h2 className="text-lg font-bold text-ink mb-3">{t(lang, "aboutCreditsHeading")}</h2>
          <p className="text-sm text-ink-muted prose-measure mb-4">{t(lang, "aboutPrivacySummary")}</p>
          <ul className="space-y-2 text-sm text-ink">
            <li>
              <span className="font-semibold">Spitch Speech AI:</span> West African Speech-to-Text and offline Nigerian voice synthesis (sade, ufoma, remi)
            </li>
            <li>
              <span className="font-semibold">YarnGPT (Saheed Azeez):</span> Nigerian-accented Text-to-Speech synthesis (idera) &amp; open-weight YarnGPT2b (Apache-2.0)
            </li>
            <li>
              <span className="font-semibold">Multilingual Matching:</span> sentence-transformers/LaBSE (Apache-2.0) + RapidFuzz (MIT)
            </li>
            <li>
              <span className="font-semibold">Privacy Policy:</span> See repository PRIVACY.md (NDPA 2023 Data Minimisation)
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
};
