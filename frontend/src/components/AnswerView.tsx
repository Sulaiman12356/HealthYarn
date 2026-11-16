import React, { useEffect, useState } from "react";
import { t } from "../i18n";
import type { AnswerPayload, Lang } from "../types";
import {
  ArrowLeftIcon,
  ReplayIcon,
  ShareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  VolumeIcon
} from "./Icons";

interface AnswerViewProps {
  lang: Lang;
  answer: AnswerPayload;
  autoplayEnabled: boolean;
  isPlaying: boolean;
  playbackRate: number;
  onPlayAnswerSequence: (answerUrl: string | null, disclaimerUrl: string | null) => void;
  onToggleSpeed: () => void;
  onFeedback: (rating: 1 | -1) => Promise<void>;
  onResetHome: () => void;
}

export const AnswerView: React.FC<AnswerViewProps> = ({
  lang,
  answer,
  autoplayEnabled,
  isPlaying,
  playbackRate,
  onPlayAnswerSequence,
  onToggleSpeed,
  onFeedback,
  onResetHome
}) => {
  const [rated, setRated] = useState<1 | -1 | null>(null);
  const [shareNote, setShareNote] = useState<string>("");

  useEffect(() => {
    setRated(null);
    setShareNote("");
    if (autoplayEnabled) {
      onPlayAnswerSequence(answer.answer_audio_url, answer.disclaimer_audio_url ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.faq_id, answer.lang]);

  const handleFeedback = async (rating: 1 | -1) => {
    if (rated !== null) return;
    setRated(rating);
    await onFeedback(rating);
  };

  const handleShare = async () => {
    const textBody = `${answer.question}\n\n${answer.answer_text}\n\n${answer.disclaimer_text || ""}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        if (answer.answer_audio_url && typeof fetch !== "undefined") {
          try {
            const resp = await fetch(answer.answer_audio_url);
            const blob = await resp.blob();
            const ext = answer.answer_audio_url.endsWith(".wav") ? "wav" : "ogg";
            const file = new File([blob], `${answer.intent_key}.${ext}`, {
              type: blob.type || "audio/ogg"
            });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: answer.question,
                text: textBody,
                files: [file]
              });
              return;
            }
          } catch {
            // Fall through to text share
          }
        }
        await navigator.share({
          title: answer.question,
          text: textBody
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(textBody);
        setShareNote("Copied to clipboard");
      }
    } catch {
      // User cancelled share dialog
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={onResetHome}
        aria-label={t(lang, "notWhatIAsked")}
        className="min-h-[48px] px-4 py-2 rounded-lg bg-surface border border-seam text-ink font-semibold inline-flex items-center gap-2 hover:bg-subtle transition-colors mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5 text-viridian" />
        <span>{t(lang, "notWhatIAsked")}</span>
      </button>

      <article className="bg-surface border border-seam rounded-xl p-6 sm:p-7 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-ink leading-snug mb-5">
          {answer.question}
        </h1>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            type="button"
            onClick={() =>
              onPlayAnswerSequence(answer.answer_audio_url, answer.disclaimer_audio_url ?? null)
            }
            aria-label={t(lang, "replayAnswer")}
            className="min-h-[48px] px-4 py-2.5 rounded-lg bg-viridian text-white font-semibold inline-flex items-center gap-2 hover:bg-viridian-hover transition-colors"
          >
            {isPlaying ? <VolumeIcon className="w-5 h-5" /> : <ReplayIcon className="w-5 h-5" />}
            <span>{t(lang, "replayAnswer")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSpeed}
            aria-label={playbackRate === 1.0 ? t(lang, "slowSpeed") : t(lang, "normalSpeed")}
            className={`min-h-[48px] px-4 py-2.5 rounded-lg border font-semibold tabular-nums transition-colors ${
              playbackRate === 0.75
                ? "bg-viridian-soft border-viridian text-viridian"
                : "bg-ground border-seam text-ink hover:bg-subtle"
            }`}
          >
            {playbackRate === 0.75 ? t(lang, "slowSpeed") : t(lang, "normalSpeed")}
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label={t(lang, "shareAnswer")}
            className="min-h-[48px] px-4 py-2.5 rounded-lg bg-ground border border-seam text-ink font-semibold inline-flex items-center gap-2 hover:bg-subtle transition-colors"
          >
            <ShareIcon className="w-5 h-5 text-viridian" />
            <span>{t(lang, "shareAnswer")}</span>
          </button>
        </div>

        {shareNote && (
          <p className="text-sm text-viridian font-medium mb-4" role="status">
            {shareNote}
          </p>
        )}

        <p className="text-lg text-ink leading-relaxed prose-measure mb-6">
          {answer.answer_text}
        </p>

        {answer.disclaimer_text && (
          <section
            aria-label={t(lang, "disclaimerLabel")}
            className="bg-subtle border border-seam rounded-lg p-4 mb-5"
          >
            <p className="text-sm font-bold text-ink mb-1">{t(lang, "disclaimerLabel")}</p>
            <p className="text-sm text-ink-muted prose-measure">{answer.disclaimer_text}</p>
          </section>
        )}

        {answer.source_reference && (
          <p className="text-xs text-ink-muted mb-6">
            <span className="font-semibold">{t(lang, "sourceLabel")}: </span>
            {answer.source_reference}
          </p>
        )}

        <div className="pt-5 border-t border-seam flex flex-wrap items-center justify-between gap-4">
          <span className="text-base font-semibold text-ink">
            {rated === null ? t(lang, "wasThisHelpful") : t(lang, "thanksFeedback")}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={rated !== null}
              onClick={() => handleFeedback(1)}
              aria-label={t(lang, "helpfulYes")}
              className={`min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border font-semibold inline-flex items-center gap-2 transition-colors ${
                rated === 1
                  ? "bg-viridian text-white border-viridian"
                  : "bg-ground border-seam text-ink hover:bg-viridian-soft disabled:opacity-60"
              }`}
            >
              <ThumbsUpIcon className="w-5 h-5" />
              <span>{t(lang, "helpfulYes")}</span>
            </button>

            <button
              type="button"
              disabled={rated !== null}
              onClick={() => handleFeedback(-1)}
              aria-label={t(lang, "helpfulNo")}
              className={`min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border font-semibold inline-flex items-center gap-2 transition-colors ${
                rated === -1
                  ? "bg-ochre text-white border-ochre"
                  : "bg-ground border-seam text-ink hover:bg-subtle disabled:opacity-60"
              }`}
            >
              <ThumbsDownIcon className="w-5 h-5" />
              <span>{t(lang, "helpfulNo")}</span>
            </button>
          </div>
        </div>
      </article>
    </main>
  );
};
