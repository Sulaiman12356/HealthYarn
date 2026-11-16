import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import type { Lang } from "../../types";
import { BrandLogo, HeroPhoneMockup, SoundWaveDivider } from "../BrandSvg";
import { CheckCircleIcon, MicIcon, PauseIcon, PlayIcon, VolumeIcon } from "../Icons";

const LandingSections = lazy(() => import("./LandingSections"));

export interface LandingPageProps {
  lang: Lang;
  contentReviewed: boolean;
  heroAudioByLang: Partial<Record<Lang, string | null>>;
  sampleAudioByLang: Partial<Record<Lang, string | null>>;
  clinicalReviewers?: string;
  languageReviewers?: string;
  onSelectLang: (lang: Lang) => void;
  onOpenApp: (topicSlug?: string, view?: "home" | "about") => void;
}

const LANG_CHIPS: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "English" },
  { code: "pcm", label: "Pidgin" },
  { code: "yo", label: "Yorùbá" }
];

export const LandingPage: React.FC<LandingPageProps> = ({
  lang,
  contentReviewed,
  heroAudioByLang,
  sampleAudioByLang,
  clinicalReviewers,
  languageReviewers,
  onSelectLang,
  onOpenApp
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSampleLang, setPlayingSampleLang] = useState<Lang | null>(null);
  const [isReadingIntro, setIsReadingIntro] = useState<boolean>(false);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    setPlayingSampleLang(null);
    setIsReadingIntro(false);
  }, []);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  // Stop active clip cleanly when switching page language
  useEffect(() => {
    stopPlayback();
  }, [lang, stopPlayback]);

  const playClipUrl = (url: string, onEnd: () => void) => {
    stopPlayback();
    const el = new Audio(url);
    audioRef.current = el;
    el.onended = () => {
      if (audioRef.current === el) {
        audioRef.current = null;
        onEnd();
      }
    };
    el.onerror = () => {
      if (audioRef.current === el) {
        audioRef.current = null;
        onEnd();
      }
    };
    el.play().catch(() => {
      audioRef.current = null;
      onEnd();
    });
  };

  const handleToggleSample = (targetLang: Lang) => {
    const clip = sampleAudioByLang[targetLang];
    if (!clip) return;
    if (playingSampleLang === targetLang) {
      stopPlayback();
      return;
    }
    setPlayingSampleLang(targetLang);
    playClipUrl(clip, () => setPlayingSampleLang(null));
  };

  const heroIntroUrl = heroAudioByLang[lang] || null;
  const canUseSpeechSynth =
    lang === "en" && typeof window !== "undefined" && "speechSynthesis" in window;
  const showReadAloud = Boolean(heroIntroUrl || canUseSpeechSynth);

  const handleReadHeadline = () => {
    if (isReadingIntro) {
      stopPlayback();
      return;
    }
    if (heroIntroUrl) {
      setIsReadingIntro(true);
      playClipUrl(heroIntroUrl, () => setIsReadingIntro(false));
      return;
    }
    if (canUseSpeechSynth) {
      stopPlayback();
      const utter = new SpeechSynthesisUtterance(
        `${t(lang, "heroHeadline")} ${t(lang, "heroSubheadline")}`
      );
      utter.lang = "en-NG";
      utter.onend = () => setIsReadingIntro(false);
      utter.onerror = () => setIsReadingIntro(false);
      setIsReadingIntro(true);
      window.speechSynthesis.speak(utter);
    }
  };

  const activeSampleUrl = sampleAudioByLang[lang] || null;
  const isPlayingHeroSample = playingSampleLang === lang;

  return (
    <div id="top" className="min-h-screen bg-hy-cream text-hy-ink flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-hy-cream border-b border-seam">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-[60px] py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <a
            href="#top"
            aria-label={t(lang, "appName")}
            className="min-h-[48px] inline-flex items-center rounded-lg pr-2 order-1"
          >
            <BrandLogo variant="brand" markSize="w-8 h-8 sm:w-9 sm:h-9" textSize="text-lg sm:text-xl" />
          </a>

          <div
            className="order-3 sm:order-2 w-full sm:w-auto sm:ml-auto flex items-center rounded-full bg-hy-sand border border-seam p-1"
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
                  aria-pressed={selected}
                  className={`flex-1 sm:flex-initial min-h-[44px] sm:min-h-[40px] px-3 sm:px-4 rounded-full text-sm font-bold transition-colors ${
                    selected
                      ? "bg-hy-green text-white"
                      : "text-hy-ink hover:bg-white/70"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              stopPlayback();
              onOpenApp();
            }}
            className="order-2 sm:order-3 min-h-[48px] px-4 sm:px-5 rounded-full bg-hy-green text-white text-sm font-bold hover:bg-hy-forest transition-colors whitespace-nowrap"
          >
            {t(lang, "navOpenApp")}
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section aria-labelledby="hero-headline" className="bg-hy-cream pt-4 pb-10 sm:pt-10 sm:pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6 items-start">
              {/* Left Top (55% -> 7/12): Eyebrow, Headline, Subheadline, CTAs */}
              <div className="lg:col-span-7 flex flex-col lg:pt-4">
                <p className="hidden sm:inline-block text-sm font-extrabold text-hy-green tracking-wide mb-3">
                  {t(lang, "heroEyebrow")}
                </p>

                <div className="flex items-start gap-2.5 mb-3 sm:mb-4">
                  <h1
                    id="hero-headline"
                    className="max-w-[16ch] text-[32px] min-[360px]:text-[36px] sm:text-[48px] lg:text-[62px] font-extrabold text-hy-ink tracking-tight leading-[1.06]"
                  >
                    {t(lang, "heroHeadline")}
                  </h1>
                  {showReadAloud && (
                    <button
                      type="button"
                      onClick={handleReadHeadline}
                      aria-label={t(lang, "heroReadAloudLabel")}
                      aria-pressed={isReadingIntro}
                      className={`min-w-[48px] min-h-[48px] mt-1 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isReadingIntro
                          ? "bg-hy-amber border-hy-amber text-hy-ink"
                          : "bg-white border-seam text-hy-green hover:bg-hy-sand"
                      }`}
                    >
                      {isReadingIntro ? (
                        <PauseIcon className="w-5 h-5" />
                      ) : (
                        <VolumeIcon className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-base sm:text-xl text-hy-muted leading-snug sm:leading-relaxed prose-measure mb-5 sm:mb-7">
                  {t(lang, "heroSubheadline")}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      onOpenApp();
                    }}
                    className="min-h-[52px] px-7 py-3 rounded-full bg-hy-amber text-hy-ink font-extrabold text-base sm:text-lg inline-flex items-center justify-center gap-2.5 shadow-soft hover:bg-amber-hover transition-colors"
                  >
                    <MicIcon className="w-5 h-5" />
                    <span>{t(lang, "heroPrimaryBtn")}</span>
                  </button>

                  {activeSampleUrl && (
                    <button
                      type="button"
                      onClick={() => handleToggleSample(lang)}
                      aria-pressed={isPlayingHeroSample}
                      className={`min-h-[52px] px-6 py-3 rounded-full border-2 font-bold text-base inline-flex items-center justify-center gap-2 transition-colors ${
                        isPlayingHeroSample
                          ? "bg-hy-green border-hy-green text-white"
                          : "bg-white border-hy-green text-hy-green hover:bg-hy-sand"
                      }`}
                    >
                      {isPlayingHeroSample ? (
                        <PauseIcon className="w-5 h-5" />
                      ) : (
                        <PlayIcon className="w-5 h-5" />
                      )}
                      <span>
                        {isPlayingHeroSample
                          ? t(lang, "heroPauseBtn")
                          : t(lang, "heroSecondaryBtn")}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right (45% -> 5/12, spans rows on desktop): Tilted Phone Mock-up */}
              <div className="lg:col-span-5 lg:row-span-2">
                <HeroPhoneMockup lang={lang} isPlayingSample={isPlayingHeroSample} />
              </div>

              {/* Trust Strip: sits below Phone on mobile, below Buttons on left column on desktop */}
              <ul className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center gap-2.5 lg:gap-x-6 lg:gap-y-2 text-sm font-semibold text-hy-ink">
                <li className="rounded-xl bg-hy-sand/70 lg:bg-transparent px-3.5 py-2.5 lg:p-0 inline-flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-hy-green shrink-0" />
                  <span>{contentReviewed ? t(lang, "trustChecked") : t(lang, "trustDemo")}</span>
                </li>
                <li className="rounded-xl bg-hy-sand/70 lg:bg-transparent px-3.5 py-2.5 lg:p-0 inline-flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-hy-green shrink-0" />
                  <span>{t(lang, "trustVoice")}</span>
                </li>
                <li className="rounded-xl bg-hy-sand/70 lg:bg-transparent px-3.5 py-2.5 lg:p-0 inline-flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-hy-green shrink-0" />
                  <span>{t(lang, "trustData")}</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <SoundWaveDivider />
            </div>
          </div>
        </section>

        {/* Below-the-fold sections lazy-loaded */}
        <Suspense fallback={<div className="py-12 text-center text-hy-muted">{t(lang, "loading")}</div>}>
          <LandingSections
            lang={lang}
            contentReviewed={contentReviewed}
            sampleAudioByLang={sampleAudioByLang}
            playingSampleLang={playingSampleLang}
            clinicalReviewers={clinicalReviewers}
            languageReviewers={languageReviewers}
            onSelectLang={onSelectLang}
            onOpenApp={(topicSlug, view) => {
              stopPlayback();
              onOpenApp(topicSlug, view);
            }}
            onToggleSampleLang={handleToggleSample}
          />
        </Suspense>
      </main>
    </div>
  );
};
