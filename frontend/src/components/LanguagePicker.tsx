import React, { useState } from "react";
import { LANGUAGE_OPTIONS, t } from "../i18n";
import type { Lang } from "../types";
import { ChevronRightIcon, VolumeIcon } from "./Icons";

interface LanguagePickerProps {
  currentLang: Lang | null;
  welcomeAudioByLang: Partial<Record<Lang, string | null>>;
  consentAudioByLang: Partial<Record<Lang, string | null>>;
  onSelect: (lang: Lang) => void;
  onPlayClip: (url: string | null | undefined) => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  currentLang,
  welcomeAudioByLang,
  consentAudioByLang,
  onSelect,
  onPlayClip
}) => {
  const [previewLang, setPreviewLang] = useState<Lang>(currentLang || "en");

  const handleLanguageFocusOrTap = (code: Lang) => {
    setPreviewLang(code);
    onPlayClip(welcomeAudioByLang[code]);
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-surface border border-seam rounded-xl p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
          {t(previewLang, "welcomeTitle")}
        </h1>
        <p className="text-ink-muted prose-measure mb-6">
          {t(previewLang, "welcomeSubtitle")}
        </p>

        <div className="space-y-3 mb-8" role="group" aria-label={t(previewLang, "welcomeTitle")}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = previewLang === opt.code;
            return (
              <div
                key={opt.code}
                className={`flex items-center justify-between gap-3 rounded-xl border transition-colors ${
                  isSelected
                    ? "bg-viridian-soft border-viridian"
                    : "bg-ground border-seam hover:border-viridian"
                }`}
              >
                <button
                  type="button"
                  onFocus={() => handleLanguageFocusOrTap(opt.code)}
                  onClick={() => {
                    onPlayClip(welcomeAudioByLang[opt.code]);
                    onSelect(opt.code);
                  }}
                  aria-label={`${opt.nativeLabel} — ${t(opt.code, "continueBtn")}`}
                  className="flex-1 min-h-[64px] px-5 py-4 text-left flex items-center justify-between rounded-xl"
                >
                  <div>
                    <div className="text-xl font-bold text-ink">{opt.nativeLabel}</div>
                    <div className="text-sm text-ink-muted">{opt.englishHint}</div>
                  </div>
                  <ChevronRightIcon className="w-6 h-6 text-viridian shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageFocusOrTap(opt.code)}
                  aria-label={`${t(opt.code, "playQuestionAudio")} (${opt.nativeLabel})`}
                  className="min-w-[52px] min-h-[52px] mr-2 rounded-lg bg-surface border border-seam text-viridian hover:bg-viridian hover:text-white flex items-center justify-center transition-colors"
                >
                  <VolumeIcon className="w-6 h-6" />
                </button>
              </div>
            );
          })}
        </div>

        <section
          aria-labelledby="consent-heading"
          className="bg-subtle border border-seam rounded-xl p-5"
        >
          <h2 id="consent-heading" className="text-lg font-bold text-ink mb-2">
            {t(previewLang, "consentHeading")}
          </h2>
          <p className="text-ink-muted prose-measure mb-4">
            {t(previewLang, "consentBody")}
          </p>
          <button
            type="button"
            onClick={() => onPlayClip(consentAudioByLang[previewLang])}
            aria-label={t(previewLang, "consentListen")}
            className="min-h-[48px] px-4 py-2.5 rounded-lg bg-surface border border-seam text-viridian font-semibold inline-flex items-center gap-2 hover:bg-viridian-soft transition-colors"
          >
            <VolumeIcon className="w-5 h-5" />
            <span>{t(previewLang, "consentListen")}</span>
          </button>
        </section>
      </div>
    </main>
  );
};
