import React from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { ABOUT_CONFIG } from "../config/aboutConfig";
import { BrandLogo } from "./BrandSvg";
import type { NavRoute } from "./SiteHeader";

export interface SiteFooterProps {
  lang: Lang;
  contentReviewed: boolean;
  clinicalReviewers?: string;
  languageReviewers?: string;
  contactEmail?: string;
  onSelectLang: (lang: Lang) => void;
  onOpenApp: () => void;
  onNavigateRoute: (route: NavRoute) => void;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  lang,
  contentReviewed,
  clinicalReviewers,
  languageReviewers,
  contactEmail = ABOUT_CONFIG.contactEmail,
  onSelectLang,
  onOpenApp,
  onNavigateRoute
}) => {
  return (
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
              onClick={() => onNavigateRoute("about")}
              className="min-h-[48px] px-3 text-sm font-semibold text-hy-cream hover:text-white underline"
            >
              {t(lang, "aboutLink")}
            </button>
            <button
              type="button"
              onClick={() => onNavigateRoute("privacy")}
              className="min-h-[48px] px-3 inline-flex items-center text-sm font-semibold text-hy-cream hover:text-white underline"
            >
              {t(lang, "footerPrivacyLink")}
            </button>
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}?subject=HealthYarn%20Contact`}
                className="min-h-[48px] px-3 inline-flex items-center text-sm font-semibold text-hy-cream hover:text-white underline"
              >
                {t(lang, "footerContactLink")}
              </a>
            )}
            <button
              type="button"
              onClick={() => onNavigateRoute("admin")}
              className="min-h-[48px] px-3 text-sm font-semibold text-hy-cream hover:text-white underline"
            >
              {t(lang, "navStaff")}
            </button>
            <button
              type="button"
              onClick={onOpenApp}
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
  );
};
