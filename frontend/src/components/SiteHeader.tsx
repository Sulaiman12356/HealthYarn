import React from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { BrandLogo } from "./BrandSvg";

export type NavRoute = "landing" | "app" | "about" | "admin" | "privacy" | "credits";

export interface SiteHeaderProps {
  activeRoute: NavRoute;
  lang: Lang;
  onSelectLang: (lang: Lang) => void;
  onNavigate: (route: NavRoute) => void;
}

const LANG_CHIPS: Array<{ code: Lang; label: string; shortLabel: string }> = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "pcm", label: "Pidgin", shortLabel: "Pidgin" },
  { code: "yo", label: "Yorùbá", shortLabel: "Yorùbá" }
];

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  activeRoute,
  lang,
  onSelectLang,
  onNavigate
}) => {
  const navItems: Array<{ route: NavRoute; label: string }> = [
    { route: "landing", label: t(lang, "navOverview") },
    { route: "app", label: t(lang, "navVoiceApp") },
    { route: "about", label: t(lang, "navAbout") },
    { route: "admin", label: t(lang, "navStaff") }
  ];

  return (
    <header className="sticky top-0 z-30 bg-hy-cream border-b border-seam">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-1.5 md:py-0 md:min-h-[64px] flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-4">
        {/* Row 1: Brand + Language pills (mobile) / Brand (desktop) */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate("landing")}
            aria-label={`${t(lang, "appName")} — ${t(lang, "navOverview")}`}
            className="min-h-[44px] md:min-h-[48px] inline-flex items-center rounded-lg pr-1 text-left shrink-0"
          >
            <BrandLogo
              variant="brand"
              markSize="w-7 h-7 sm:w-9 sm:h-9"
              textSize="text-base sm:text-xl"
            />
          </button>

          {/* Mobile compact language switcher sits cleanly on row 1 */}
          <div
            className="flex md:hidden items-center rounded-full bg-hy-sand border border-seam p-0.5 shrink-0"
            role="group"
            aria-label={t(lang, "langSwitchLabel")}
          >
            {LANG_CHIPS.map((chip) => {
              const selected = lang === chip.code;
              return (
                <button
                  key={chip.code}
                  type="button"
                  onClick={() => onSelectLang(chip.code)}
                  aria-label={chip.label}
                  aria-pressed={selected}
                  className={`min-h-[38px] px-2.5 min-[400px]:px-3 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                    selected ? "bg-hy-green text-white" : "text-hy-ink"
                  }`}
                >
                  <span className="min-[400px]:hidden">{chip.shortLabel}</span>
                  <span className="hidden min-[400px]:inline">{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center/Mobile Nav Strip: 1-tap movement across /, /app, /about, /admin */}
        <nav
          aria-label="Primary navigation"
          className="grid grid-cols-4 md:flex md:items-center gap-1 rounded-full bg-hy-sand/70 border border-seam p-1"
        >
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => onNavigate(item.route)}
                aria-current={isActive ? "page" : undefined}
                className={`min-h-[40px] px-2 md:px-4 rounded-full text-xs sm:text-sm font-bold text-center whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-hy-green text-white"
                    : "text-hy-ink hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Desktop right: 3-way language switcher */}
        <div
          className="hidden md:inline-flex items-center rounded-full bg-hy-sand border border-seam p-1 shrink-0"
          role="group"
          aria-label={t(lang, "langSwitchLabel")}
        >
          {LANG_CHIPS.map((chip) => {
            const selected = lang === chip.code;
            return (
              <button
                key={chip.code}
                type="button"
                onClick={() => onSelectLang(chip.code)}
                aria-label={chip.label}
                aria-pressed={selected}
                className={`min-h-[40px] px-3.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${
                  selected ? "bg-hy-green text-white" : "text-hy-ink hover:bg-white"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
