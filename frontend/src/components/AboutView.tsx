import React, { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { ABOUT_CONFIG, getInitials, type AboutConfig } from "../config/aboutConfig";
import { SoundWaveDivider } from "./BrandSvg";
import { SiteHeader, type NavRoute } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LockIcon,
  MicIcon,
  PauseIcon,
  ShieldCheckIcon,
  UserIcon,
  VolumeIcon,
  XCircleIcon
} from "./Icons";

export interface AboutViewProps {
  lang: Lang;
  contentReviewed?: boolean;
  clinicalReviewers?: string;
  languageReviewers?: string;
  config?: AboutConfig;
  onSelectLang: (lang: Lang) => void;
  onNavigateRoute: (route: NavRoute) => void;
}

interface SectionAudioSpec {
  id: number;
  speechText: string;
}

export const AboutView: React.FC<AboutViewProps> = ({
  lang,
  contentReviewed = true,
  clinicalReviewers,
  languageReviewers,
  config = ABOUT_CONFIG,
  onSelectLang,
  onNavigateRoute
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech synthesis cancellation errors
      }
    }
    setActiveSectionId(null);
  }, []);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  useEffect(() => {
    stopAudio();
  }, [lang, stopAudio]);

  const toggleSectionAudio = ({ id, speechText }: SectionAudioSpec) => {
    if (activeSectionId === id) {
      stopAudio();
      return;
    }
    stopAudio();

    const speakFallbackEn = () => {
      if (lang === "en" && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utter = new SpeechSynthesisUtterance(speechText);
          utter.lang = "en-NG";
          utter.onend = () => setActiveSectionId(null);
          utter.onerror = () => setActiveSectionId(null);
          setActiveSectionId(id);
          window.speechSynthesis.speak(utter);
          return;
        } catch {
          // Ignore
        }
      }
      setActiveSectionId(null);
    };

    const clipUrl = `/static/audio/about/${lang}/section_${id}.ogg`;
    if (typeof Audio !== "undefined") {
      const el = new Audio(clipUrl);
      audioRef.current = el;
      setActiveSectionId(id);
      el.onended = () => {
        if (audioRef.current === el) {
          audioRef.current = null;
          setActiveSectionId(null);
        }
      };
      el.onerror = () => {
        if (audioRef.current === el) {
          audioRef.current = null;
          speakFallbackEn();
        }
      };
      el.play().catch(() => {
        if (audioRef.current === el) {
          audioRef.current = null;
        }
        speakFallbackEn();
      });
    } else {
      speakFallbackEn();
    }
  };

  const renderSpeakerButton = (
    spec: SectionAudioSpec,
    sectionTitle: string,
    variant: "onLight" | "onDark" = "onLight"
  ) => {
    const isPlaying = activeSectionId === spec.id;
    const baseClasses =
      "min-w-[48px] min-h-[48px] rounded-full border flex items-center justify-center shrink-0 transition-colors";
    const styleClasses =
      variant === "onDark"
        ? isPlaying
          ? "bg-hy-amber border-hy-amber text-hy-ink"
          : "bg-white/10 border-white/30 text-white hover:bg-white/20"
        : isPlaying
        ? "bg-hy-amber border-hy-amber text-hy-ink"
        : "bg-white border-seam text-hy-green hover:bg-hy-sand";

    return (
      <button
        type="button"
        onClick={() => toggleSectionAudio(spec)}
        aria-label={`${isPlaying ? t(lang, "aboutReadAloudPause") : t(lang, "aboutReadAloudPlay")}: ${sectionTitle}`}
        aria-pressed={isPlaying}
        className={`${baseClasses} ${styleClasses}`}
      >
        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
      </button>
    );
  };

  const hasTeam = config.team.length > 0;
  const hasReviewers = config.reviewers.length > 0 && contentReviewed;
  const hasInstitution = Boolean(config.institution);
  const showPeopleSection = hasTeam || hasReviewers || hasInstitution;

  const step1 = t(lang, "aboutSec3Step1");
  const step2 = contentReviewed ? t(lang, "aboutSec3Step2") : t(lang, "aboutSec3Step2Demo");
  const step3 = contentReviewed ? t(lang, "aboutSec3Step3") : t(lang, "aboutSec3Step3Demo");
  const step4 = t(lang, "aboutSec3Step4");
  const safeNote = contentReviewed ? t(lang, "aboutSec3Note") : t(lang, "aboutSec3NoteDemo");

  const sttSentence = config.sttProvider
    ? ` ${t(lang, "aboutSec6SttTemplate").replace("{stt}", config.sttProvider)}`
    : "";
  const creditsParagraph = `${t(lang, "aboutSec6Voices")}${sttSentence} ${t(lang, "aboutSec6Rest")}`;

  return (
    <div className="min-h-screen bg-hy-cream text-hy-ink flex flex-col">
      <SiteHeader
        activeRoute="about"
        lang={lang}
        onSelectLang={onSelectLang}
        onNavigate={(route) => {
          stopAudio();
          onNavigateRoute(route);
        }}
      />

      <main className="flex-1">
        {/* 1. Opening (Kola Cream, small sound-wave illustration) */}
        <section className="bg-hy-cream py-12 sm:py-16">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6">
            <div className="mb-6">
              <SoundWaveDivider className="w-52 h-6 text-hy-amber/80" />
            </div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-hy-ink tracking-tight leading-tight">
                {t(lang, "aboutSec1Title")}
              </h1>
              {renderSpeakerButton(
                { id: 1, speechText: `${t(lang, "aboutSec1Title")}. ${t(lang, "aboutSec1Lead")}` },
                t(lang, "aboutSec1Title")
              )}
            </div>
            <p className="text-xl sm:text-2xl text-hy-muted font-medium leading-relaxed">
              {t(lang, "aboutSec1Lead")}
            </p>
          </div>
        </section>

        {/* 2. Our story (Kola Cream) */}
        <section className="bg-hy-cream py-10 sm:py-14 border-t border-seam/70">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-hy-ink">
                {t(lang, "aboutSec2Title")}
              </h2>
              {renderSpeakerButton(
                {
                  id: 2,
                  speechText: `${t(lang, "aboutSec2Title")}. ${t(lang, "aboutSec2Body")} ${t(
                    lang,
                    "aboutSec2Quote"
                  )}`
                },
                t(lang, "aboutSec2Title")
              )}
            </div>
            <p className="text-base sm:text-lg text-hy-ink leading-relaxed mb-8">
              {t(lang, "aboutSec2Body")}
            </p>
            <blockquote className="border-l-4 border-hy-green pl-5 py-1 text-2xl sm:text-3xl font-extrabold text-hy-green leading-snug">
              “{t(lang, "aboutSec2Quote")}”
            </blockquote>
          </div>
        </section>

        {/* 3. How we keep answers safe (Full-width Leaf Green band) */}
        <section className="bg-hy-green text-white py-14 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="max-w-[720px] mx-auto mb-10">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                  {t(lang, "aboutSec3Title")}
                </h2>
                {renderSpeakerButton(
                  {
                    id: 3,
                    speechText: `${t(lang, "aboutSec3Title")} 1. ${step1}. 2. ${step2}. 3. ${step3}. 4. ${step4}. ${safeNote}`
                  },
                  t(lang, "aboutSec3Title"),
                  "onDark"
                )}
              </div>
            </div>

            {/* 4 numbered steps in a row on desktop, stacked on mobile */}
            <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[step1, step2, step3, step4].map((stepText, idx) => (
                <li
                  key={idx}
                  className="bg-hy-forest/70 border border-white/15 rounded-card p-5 flex flex-col gap-3"
                >
                  <span className="w-8 h-8 rounded-full bg-hy-amber text-hy-ink font-extrabold text-sm flex items-center justify-center shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <p className="text-sm sm:text-base text-hy-cream leading-relaxed font-medium">
                    {stepText}
                  </p>
                </li>
              ))}
            </ol>

            <div className="max-w-[720px] mx-auto">
              <p className="text-base sm:text-lg text-hy-cream leading-relaxed font-medium">
                {safeNote}
              </p>
            </div>
          </div>
        </section>

        {/* 4. What HealthYarn will and won't do (Kola Cream, 2 columns + Alert Red callout) */}
        <section className="bg-hy-cream py-14 sm:py-16">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6">
            <div className="flex items-start justify-between gap-4 mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-hy-ink">
                {t(lang, "aboutSec4Title")}
              </h2>
              {renderSpeakerButton(
                {
                  id: 4,
                  speechText: `${t(lang, "aboutSec4Title")}. ${t(lang, "aboutSec4WillTitle")}: ${t(
                    lang,
                    "aboutSec4Will1"
                  )}, ${t(lang, "aboutSec4Will2")}, ${t(lang, "aboutSec4Will3")}, ${t(
                    lang,
                    "aboutSec4Will4"
                  )}. ${t(lang, "aboutSec4WontTitle")}: ${t(lang, "aboutSec4Wont1")}, ${t(
                    lang,
                    "aboutSec4Wont2"
                  )}, ${t(lang, "aboutSec4Wont3")}, ${t(lang, "aboutSec4Wont4")}. ${t(
                    lang,
                    "aboutSec4Emergency"
                  )}`
                },
                t(lang, "aboutSec4Title")
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              <div className="bg-white border border-seam rounded-card p-6 shadow-soft">
                <h3 className="text-lg font-extrabold text-hy-green mb-4 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 shrink-0" />
                  <span>{t(lang, "aboutSec4WillTitle")}</span>
                </h3>
                <ul className="space-y-3 text-base text-hy-ink leading-relaxed">
                  {(["aboutSec4Will1", "aboutSec4Will2", "aboutSec4Will3", "aboutSec4Will4"] as const).map(
                    (k) => (
                      <li key={k} className="flex items-start gap-2.5">
                        <CheckCircleIcon className="w-5 h-5 text-hy-green shrink-0 mt-0.5" />
                        <span>{t(lang, k)}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div className="bg-white border border-seam rounded-card p-6 shadow-soft">
                <h3 className="text-lg font-extrabold text-hy-alert mb-4 flex items-center gap-2">
                  <XCircleIcon className="w-5 h-5 shrink-0" />
                  <span>{t(lang, "aboutSec4WontTitle")}</span>
                </h3>
                <ul className="space-y-3 text-base text-hy-ink leading-relaxed">
                  {(["aboutSec4Wont1", "aboutSec4Wont2", "aboutSec4Wont3", "aboutSec4Wont4"] as const).map(
                    (k) => (
                      <li key={k} className="flex items-start gap-2.5">
                        <XCircleIcon className="w-5 h-5 text-hy-alert shrink-0 mt-0.5" />
                        <span>{t(lang, k)}</span>
                      </li>
                    )
                  )}
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
              <p className="text-base sm:text-lg font-bold leading-relaxed">
                {t(lang, "aboutSec4Emergency")}
              </p>
            </div>
          </div>
        </section>

        {/* 5. The people behind it (Sand band — only rendered when config has real entries) */}
        {showPeopleSection && (
          <section className="bg-hy-sand py-14 sm:py-16 border-y border-seam">
            <div className="max-w-[720px] mx-auto px-4 sm:px-6 space-y-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-hy-ink">
                  {t(lang, "aboutSec5Title")}
                </h2>
                {renderSpeakerButton(
                  {
                    id: 5,
                    speechText: `${t(lang, "aboutSec5Title")}. ${
                      hasInstitution
                        ? t(lang, "aboutSec5InstitutionTemplate").replace(
                            "{institution}",
                            config.institution
                          )
                        : ""
                    }`
                  },
                  t(lang, "aboutSec5Title")
                )}
              </div>

              {hasTeam && (
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-hy-green mb-4">
                    {t(lang, "aboutSec5TeamHeading")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {config.team.map((member) => (
                      <div
                        key={member.name}
                        className="bg-white border border-seam rounded-card p-5 shadow-soft flex items-start gap-4"
                      >
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={member.name}
                            className="w-12 h-12 rounded-full object-cover border border-seam shrink-0"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="w-12 h-12 rounded-full bg-hy-green text-white font-extrabold text-sm flex items-center justify-center shrink-0"
                          >
                            {getInitials(member.name)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-hy-ink">{member.name}</div>
                          {member.role && (
                            <div className="text-xs font-bold text-hy-green mb-1">
                              {member.role}
                            </div>
                          )}
                          {member.contribution && (
                            <p className="text-sm text-hy-muted leading-snug">
                              {member.contribution}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasReviewers && (
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-hy-green mb-4">
                    {t(lang, "aboutSec5ReviewersHeading")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {config.reviewers.map((rev) => (
                      <div
                        key={`${rev.name}-${rev.profession}`}
                        className="bg-white border border-seam rounded-card p-5 shadow-soft"
                      >
                        <div className="text-base font-extrabold text-hy-ink">{rev.name}</div>
                        {rev.profession && (
                          <div className="text-xs font-bold text-hy-green mt-0.5 mb-1.5">
                            {rev.profession}
                          </div>
                        )}
                        {rev.reviewed && (
                          <p className="text-sm text-hy-muted leading-snug">{rev.reviewed}</p>
                        )}
                        {rev.date && (
                          <div className="text-xs text-hy-muted mt-2 tabular-nums">{rev.date}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasInstitution && (
                <p className="text-base font-semibold text-hy-ink leading-relaxed">
                  {t(lang, "aboutSec5InstitutionTemplate").replace(
                    "{institution}",
                    config.institution
                  )}
                </p>
              )}
            </div>
          </section>
        )}

        {/* 6. Built with (Full-width Forest band, small type) */}
        <section className="bg-hy-forest text-hy-cream py-14 sm:py-16">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {t(lang, "aboutSec6Title")}
              </h2>
              {renderSpeakerButton(
                { id: 6, speechText: `${t(lang, "aboutSec6Title")}. ${creditsParagraph}` },
                t(lang, "aboutSec6Title"),
                "onDark"
              )}
            </div>
            <p className="text-sm sm:text-base text-hy-cream/90 leading-relaxed mb-5">
              {creditsParagraph}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  stopAudio();
                  onNavigateRoute("credits");
                }}
                className="min-h-[48px] inline-flex items-center text-sm font-bold text-hy-amber underline hover:text-white transition-colors"
              >
                {t(lang, "aboutSec6CreditsLink")} →
              </button>
              {config.licensesRepoUrl && (
                <a
                  href={config.licensesRepoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[48px] inline-flex items-center text-sm font-semibold text-hy-cream underline hover:text-white"
                >
                  LICENSES.md
                </a>
              )}
            </div>
          </div>
        </section>

        {/* 7. Your privacy (Kola Cream, three icons) */}
        <section className="bg-hy-cream py-14 sm:py-16">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-hy-ink">
                {t(lang, "aboutSec7Title")}
              </h2>
              {renderSpeakerButton(
                {
                  id: 7,
                  speechText: `${t(lang, "aboutSec7Title")}. ${t(lang, "aboutSec7Point1")}. ${t(
                    lang,
                    "aboutSec7Point2"
                  )}. ${t(lang, "aboutSec7Point3")}`
                },
                t(lang, "aboutSec7Title")
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { Icon: UserIcon, label: t(lang, "aboutSec7Point1") },
                { Icon: ShieldCheckIcon, label: t(lang, "aboutSec7Point2") },
                { Icon: LockIcon, label: t(lang, "aboutSec7Point3") }
              ].map(({ Icon, label }, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-seam rounded-card p-5 shadow-soft flex flex-col gap-3"
                >
                  <span className="w-10 h-10 rounded-xl bg-hy-sand text-hy-green flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <p className="text-sm sm:text-base font-bold text-hy-ink leading-snug">{label}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                stopAudio();
                onNavigateRoute("privacy");
              }}
              className="min-h-[48px] inline-flex items-center text-base font-bold text-hy-green underline hover:text-hy-forest transition-colors"
            >
              {t(lang, "aboutSec7Link")} →
            </button>
          </div>
        </section>

        {/* 8. What's next (Kola Cream) */}
        <section className="bg-hy-cream py-10 sm:py-14 border-t border-seam/70">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-hy-ink">
                {t(lang, "aboutSec8Title")}
              </h2>
              {renderSpeakerButton(
                {
                  id: 8,
                  speechText: `${t(lang, "aboutSec8Title")}. ${t(lang, "aboutSec8Body")}`
                },
                t(lang, "aboutSec8Title")
              )}
            </div>
            <p className="text-base sm:text-lg text-hy-ink leading-relaxed">
              {t(lang, "aboutSec8Body")}
            </p>
          </div>
        </section>

        {/* 9. Get in touch (Full-width Leaf Green band, centred) */}
        <section className="bg-hy-green text-white py-14 sm:py-18 text-center">
          <div className="max-w-[720px] mx-auto px-4 sm:px-6 flex flex-col items-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                {t(lang, "aboutSec9Title")}
              </h2>
              {renderSpeakerButton(
                { id: 9, speechText: t(lang, "aboutSec9Title") },
                t(lang, "aboutSec9Title"),
                "onDark"
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              {config.contactEmail && (
                <a
                  href={`mailto:${config.contactEmail}?subject=HealthYarn%20Partnership`}
                  className="min-h-[52px] px-7 py-3.5 rounded-full bg-white text-hy-green font-extrabold text-base inline-flex items-center justify-center hover:bg-hy-cream transition-colors"
                >
                  {t(lang, "partnersBtn")}
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  stopAudio();
                  onNavigateRoute("app");
                }}
                className="min-h-[52px] px-7 py-3.5 rounded-full bg-hy-amber text-hy-ink font-extrabold text-base inline-flex items-center justify-center gap-2 shadow-lift hover:bg-amber-hover transition-colors"
              >
                <MicIcon className="w-5 h-5" />
                <span>{t(lang, "aboutSec9AskBtn")}</span>
              </button>
            </div>

            {config.contentLastReviewed && contentReviewed && (
              <p className="text-sm text-hy-cream/85 tabular-nums">
                {t(lang, "aboutSec9ReviewedPrefix")} {config.contentLastReviewed}
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter
        lang={lang}
        contentReviewed={contentReviewed}
        clinicalReviewers={clinicalReviewers}
        languageReviewers={languageReviewers}
        contactEmail={config.contactEmail}
        onSelectLang={onSelectLang}
        onOpenApp={() => {
          stopAudio();
          onNavigateRoute("app");
        }}
        onNavigateRoute={(route) => {
          stopAudio();
          onNavigateRoute(route);
        }}
      />
    </div>
  );
};
