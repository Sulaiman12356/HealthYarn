import React, { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import type { Clinic, Lang } from "../types";
import { AlertTriangleIcon, PhoneIcon, VolumeIcon } from "./Icons";

interface RedFlagAlertViewProps {
  lang: Lang;
  messageText: string;
  messageAudioUrl: string | null;
  clinics: Clinic[];
  autoplayEnabled: boolean;
  onPlayClip: (url: string | null | undefined) => void;
  onDismiss: () => void;
}

export const RedFlagAlertView: React.FC<RedFlagAlertViewProps> = ({
  lang,
  messageText,
  messageAudioUrl,
  clinics,
  autoplayEnabled,
  onPlayClip,
  onDismiss
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(5);
  const [stateFilter, setStateFilter] = useState<string>("");

  useEffect(() => {
    setSecondsLeft(5);
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (autoplayEnabled && messageAudioUrl) {
      onPlayClip(messageAudioUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageAudioUrl]);

  const states = useMemo(
    () => Array.from(new Set(clinics.map((c) => c.state))).sort(),
    [clinics]
  );

  const visibleClinics = useMemo(
    () => (stateFilter ? clinics.filter((c) => c.state === stateFilter) : clinics),
    [clinics, stateFilter]
  );

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="red-flag-heading"
      className="min-h-screen bg-crimson text-white px-4 py-6"
    >
      <div className="max-w-2xl mx-auto">
        <div className="bg-crimson-dark border border-red-400/50 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white text-crimson flex items-center justify-center shrink-0">
                <AlertTriangleIcon className="w-7 h-7" />
              </div>
              <h1 id="red-flag-heading" className="text-2xl sm:text-3xl font-bold leading-tight">
                {t(lang, "redFlagTitle")}
              </h1>
            </div>
            {messageAudioUrl && (
              <button
                type="button"
                onClick={() => onPlayClip(messageAudioUrl)}
                aria-label={t(lang, "replayAnswer")}
                className="min-w-[48px] min-h-[48px] rounded-xl bg-white text-crimson flex items-center justify-center shrink-0"
              >
                <VolumeIcon className="w-6 h-6" />
              </button>
            )}
          </div>

          <p className="text-lg font-semibold leading-relaxed prose-measure mb-3">
            {messageText}
          </p>
          <p className="text-sm text-red-100 prose-measure">
            {t(lang, "redFlagCallInstruction")}
          </p>
        </div>

        <section className="bg-surface text-ink rounded-2xl p-5 sm:p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <label htmlFor="clinic-state-filter" className="text-sm font-bold text-ink">
              {t(lang, "redFlagFilterState")}
            </label>
            <select
              id="clinic-state-filter"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="min-h-[48px] px-3 py-2 rounded-lg bg-ground border border-seam text-ink font-semibold"
            >
              <option value="">{t(lang, "redFlagAllStates")}</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <ul className="space-y-3">
            {visibleClinics.map((clinic) => (
              <li
                key={clinic.id}
                className="bg-ground border border-seam rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-ink text-base">{clinic.name}</div>
                  <div className="text-sm text-ink-muted">
                    {clinic.type} · {clinic.lga}, {clinic.state}
                  </div>
                </div>
                <a
                  href={`tel:${clinic.phone}`}
                  aria-label={`${t(lang, "redFlagCallBtn")} ${clinic.name}`}
                  className="min-h-[52px] px-5 py-3 rounded-xl bg-crimson text-white font-bold inline-flex items-center gap-2 hover:bg-crimson-dark transition-colors tabular-nums"
                >
                  <PhoneIcon className="w-5 h-5" />
                  <span>{clinic.phone}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="bg-crimson-dark border border-red-400/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm font-semibold text-red-100 tabular-nums">
            {secondsLeft > 0
              ? `${t(lang, "redFlagLockNotice")} ${secondsLeft}s`
              : t(lang, "redFlagReturnBtn")}
          </p>
          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={onDismiss}
            aria-label={t(lang, "redFlagReturnBtn")}
            className="min-h-[52px] px-6 py-3 rounded-xl bg-white text-crimson font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity tabular-nums"
          >
            {secondsLeft > 0 ? `${secondsLeft}s` : t(lang, "redFlagReturnBtn")}
          </button>
        </div>
      </div>
    </div>
  );
};
