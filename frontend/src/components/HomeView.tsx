import React, { useState } from "react";
import { t } from "../i18n";
import type { Lang, TopicSummary } from "../types";
import { ChevronRightIcon, MicIcon, TopicIcon, WifiOffIcon } from "./Icons";

interface HomeViewProps {
  lang: Lang;
  topics: TopicSummary[];
  loading: boolean;
  isOffline: boolean;
  isRecording: boolean;
  recordingSeconds: number;
  isSubmittingVoice: boolean;
  voiceError: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSubmitTypedText?: (text: string) => void;
  onSelectTopic: (slug: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  lang,
  topics,
  loading,
  isOffline,
  isRecording,
  recordingSeconds,
  isSubmittingVoice,
  voiceError,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSubmitTypedText,
  onSelectTopic
}) => {
  const [tapMode, setTapMode] = useState(false);
  const [typedQuery, setTypedQuery] = useState("");

  const remaining = Math.max(0, 15 - recordingSeconds);

  const handleMicTap = () => {
    if (isOffline || isSubmittingVoice) return;
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <section
        aria-label={t(lang, "holdToSpeak")}
        className="bg-surface border border-seam rounded-2xl p-6 sm:p-8 text-center shadow-sm mb-8"
      >
        {isOffline ? (
          <div className="py-4 flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-ochre-bg border border-ochre-border text-ochre flex items-center justify-center">
              <WifiOffIcon className="w-9 h-9" />
            </div>
            <p className="text-lg font-bold text-ink max-w-sm">
              {t(lang, "micNeedsInternet")}
            </p>
          </div>
        ) : isRecording ? (
          <div className="py-2 flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-hy-amber/25 border-2 border-hy-amber flex flex-col items-center justify-center animate-pulse">
                <MicIcon className="w-10 h-10 text-hy-ink mb-1" />
                <span className="text-2xl font-bold text-hy-ink tabular-nums">
                  {remaining}s
                </span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">{t(lang, "listeningTitle")}</h1>
              <p className="text-sm text-ink-muted mt-1">{t(lang, "listeningHint")}</p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={onStopRecording}
                aria-label={t(lang, "tapToStop")}
                className="min-h-[52px] px-6 py-3 rounded-full bg-viridian text-white font-bold hover:bg-viridian-hover transition-colors"
              >
                {t(lang, "tapToStop")}
              </button>
              <button
                type="button"
                onClick={onCancelRecording}
                aria-label={t(lang, "cancel")}
                className="min-h-[52px] px-5 py-3 rounded-full bg-ground border border-seam text-ink font-semibold hover:bg-subtle transition-colors"
              >
                {t(lang, "cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              disabled={isSubmittingVoice}
              onPointerDown={!tapMode ? onStartRecording : undefined}
              onPointerUp={!tapMode ? onStopRecording : undefined}
              onPointerCancel={!tapMode ? onCancelRecording : undefined}
              onClick={tapMode ? handleMicTap : undefined}
              onKeyDown={(e) => {
                if (!tapMode && (e.key === " " || e.key === "Enter")) {
                  e.preventDefault();
                  handleMicTap();
                }
              }}
              aria-label={tapMode ? t(lang, "tapToStart") : t(lang, "holdToSpeak")}
              className="w-36 h-36 rounded-full bg-hy-amber text-hy-ink border-2 border-hy-ink/10 shadow-md hover:bg-amber-hover active:scale-95 transition-transform flex flex-col items-center justify-center gap-1.5 disabled:opacity-60 select-none touch-none"
            >
              <MicIcon className="w-11 h-11" />
              <span className="text-xs font-extrabold px-2 leading-tight">
                {isSubmittingVoice
                  ? t(lang, "processingVoice")
                  : tapMode
                  ? t(lang, "tapToStart")
                  : t(lang, "holdToSpeak")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTapMode((v) => !v)}
              aria-label={tapMode ? t(lang, "switchHoldMode") : t(lang, "switchTapMode")}
              className="min-h-[48px] px-4 py-2 rounded-lg text-sm font-semibold text-viridian hover:bg-viridian-soft transition-colors"
            >
              {tapMode ? t(lang, "switchHoldMode") : t(lang, "switchTapMode")}
            </button>

            {voiceError && (
              <div
                role="alert"
                className="w-full text-left bg-ochre-bg border border-ochre-border text-ochre rounded-xl p-4 text-sm font-medium"
              >
                {voiceError}
              </div>
            )}

            {onSubmitTypedText && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typedQuery.trim()) {
                    onSubmitTypedText(typedQuery.trim());
                    setTypedQuery("");
                  }
                }}
                className="w-full pt-4 border-t border-seam flex items-center gap-2"
              >
                <input
                  type="text"
                  value={typedQuery}
                  onChange={(e) => setTypedQuery(e.target.value)}
                  placeholder={t(lang, "tryTypedQuestion")}
                  aria-label={t(lang, "tryTypedQuestion")}
                  className="flex-1 min-h-[48px] px-3.5 py-2 rounded-lg bg-ground border border-seam text-ink text-base placeholder:text-ink-muted"
                />
                <button
                  type="submit"
                  disabled={isSubmittingVoice || !typedQuery.trim()}
                  aria-label={t(lang, "sendTypedQuestion")}
                  className="min-h-[48px] px-4 py-2 rounded-lg bg-viridian text-white font-semibold hover:bg-viridian-hover disabled:opacity-50 transition-colors"
                >
                  {t(lang, "sendTypedQuestion")}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="text-xl font-bold text-ink mt-2 mb-4">
          {t(lang, "topicsHeading")}
        </h2>

        {loading && topics.length === 0 ? (
          <div className="space-y-3" aria-busy="true" aria-label={t(lang, "loading")}>
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="h-20 rounded-xl bg-subtle border border-seam animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => (
              <button
                key={topic.slug}
                type="button"
                onClick={() => onSelectTopic(topic.slug)}
                aria-label={`${topic.name} (${topic.questions.length} ${t(lang, "questionsCount")})`}
                className="w-full min-h-[72px] bg-surface border border-seam rounded-xl px-4 py-3.5 text-left flex items-center justify-between gap-4 hover:border-viridian hover:bg-viridian-soft/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-card bg-hy-sand flex items-center justify-center shrink-0">
                    <TopicIcon icon={topic.icon} className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-ink leading-snug">{topic.name}</div>
                    <div className="text-sm text-ink-muted tabular-nums">
                      {topic.questions.length} {t(lang, "questionsCount")}
                    </div>
                  </div>
                </div>
                <ChevronRightIcon className="w-6 h-6 text-ink-muted shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
