import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { t } from "./i18n";
import { useAudioQueue } from "./hooks/useAudioQueue";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";
import {
  askText,
  askVoice,
  fetchAnswer,
  fetchBundle,
  fetchMeta,
  fetchTopics,
  sendFeedback
} from "./services/api";
import {
  bundleToTopicSummaries,
  getCachedBundle,
  precacheBundleAudio,
  saveCachedBundle
} from "./services/offlineCache";
import type {
  AnswerPayload,
  AskResponse,
  BundleResponse,
  Clinic,
  Lang,
  QuestionSummary,
  TopicSummary,
  UnsureCandidate
} from "./types";
import { DemoBanner } from "./components/DemoBanner";
import { LanguagePicker } from "./components/LanguagePicker";
import { HomeView } from "./components/HomeView";
import { TopicDetailView } from "./components/TopicDetailView";
import { AnswerView } from "./components/AnswerView";
import { UnsureView } from "./components/UnsureView";
import { RedFlagAlertView } from "./components/RedFlagAlertView";
import { AboutView } from "./components/AboutView";
import { CheckCircleIcon, VolumeIcon, VolumeMutedIcon, WifiOffIcon } from "./components/Icons";

const AdminPortal = lazy(() => import("./components/AdminPortal"));

type Screen =
  | { name: "welcome" }
  | { name: "home" }
  | { name: "topic"; slug: string }
  | { name: "answer"; payload: AnswerPayload }
  | {
      name: "unsure";
      messageText: string;
      messageAudioUrl: string | null;
      candidates: UnsureCandidate[];
    }
  | {
      name: "red_flag";
      messageText: string;
      messageAudioUrl: string | null;
      clinics: Clinic[];
    }
  | { name: "about" }
  | { name: "admin" };

const LANG_STORAGE_KEY = "healthyarn_lang";
const AUTOPLAY_STORAGE_KEY = "healthyarn_autoplay";

function getInitialReducedMotionAutoplay(): boolean {
  try {
    const saved = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
    if (saved !== null) return saved === "true";
    if (typeof window !== "undefined" && window.matchMedia) {
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  } catch {
    // Ignore storage access errors
  }
  return true;
}

export function App() {
  const savedLang = (() => {
    try {
      const val = localStorage.getItem(LANG_STORAGE_KEY);
      if (val === "en" || val === "yo" || val === "pcm") return val;
    } catch {
      // Ignore
    }
    return null;
  })();

  const [lang, setLang] = useState<Lang>(savedLang || "en");
  const [hasChosenLang, setHasChosenLang] = useState<boolean>(savedLang !== null);
  const initialAdminRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const [screen, setScreen] = useState<Screen>(
    initialAdminRoute ? { name: "admin" } : savedLang ? { name: "home" } : { name: "welcome" }
  );

  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [bundle, setBundle] = useState<BundleResponse | null>(null);
  const [welcomeAudioByLang, setWelcomeAudioByLang] = useState<
    Partial<Record<Lang, string | null>>
  >({});
  const [consentAudioByLang, setConsentAudioByLang] = useState<
    Partial<Record<Lang, string | null>>
  >({});
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [cachingOffline, setCachingOffline] = useState<boolean>(false);
  const [offlineReady, setOfflineReady] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [autoplayEnabled, setAutoplayEnabled] = useState<boolean>(getInitialReducedMotionAutoplay);
  const [isSubmittingVoice, setIsSubmittingVoice] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const audio = useAudioQueue();

  const handleAskResult = useCallback(
    (res: AskResponse) => {
      if (res.type === "red_flag") {
        setScreen({
          name: "red_flag",
          messageText: res.message_text,
          messageAudioUrl: res.message_audio_url,
          clinics: res.clinics
        });
        return;
      }
      if (res.type === "answer") {
        setScreen({
          name: "answer",
          payload: {
            faq_id: res.faq_id,
            intent_key: `faq_${res.faq_id}`,
            lang,
            question: res.question,
            answer_text: res.answer_text,
            question_audio_url: null,
            answer_audio_url: res.answer_audio_url,
            disclaimer_text: res.disclaimer_text,
            disclaimer_audio_url: res.disclaimer_audio_url,
            source_reference: res.source_reference,
            confidence: res.confidence,
            log_id: res.log_id
          }
        });
        return;
      }
      if (res.type === "unsure") {
        setScreen({
          name: "unsure",
          messageText: res.message_text || t(lang, "unsureTitle"),
          messageAudioUrl: res.message_audio_url ?? null,
          candidates: res.candidates
        });
        return;
      }
      setVoiceError(res.message_text || t(lang, "sttFailedMessage"));
      if (autoplayEnabled && res.message_audio_url) {
        audio.playSequence([res.message_audio_url]);
      }
    },
    [audio, autoplayEnabled, lang]
  );

  const handleVoiceBlob = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setVoiceError(null);
      setIsSubmittingVoice(true);
      try {
        const res = await askVoice(blob, lang, durationSeconds);
        handleAskResult(res);
      } catch {
        setVoiceError(t(lang, "sttFailedMessage"));
      } finally {
        setIsSubmittingVoice(false);
      }
    },
    [handleAskResult, lang]
  );

  const handleTypedQuestion = useCallback(
    async (text: string) => {
      setVoiceError(null);
      setIsSubmittingVoice(true);
      try {
        const res = await askText(text, lang);
        handleAskResult(res);
      } catch {
        setVoiceError(t(lang, "sttFailedMessage"));
      } finally {
        setIsSubmittingVoice(false);
      }
    },
    [handleAskResult, lang]
  );

  const recorder = useVoiceRecorder(handleVoiceBlob, 15);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchMeta()
      .then((m) => {
        if (!active) return;
        setDemoMode((prev) => prev || m.demo_mode);
        if (m.welcome_audio) setWelcomeAudioByLang(m.welcome_audio);
        if (m.consent_audio) setConsentAudioByLang(m.consent_audio);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const cached = getCachedBundle(lang);
    if (cached) {
      setBundle(cached);
      setTopics(bundleToTopicSummaries(cached));
      setDemoMode(cached.demo_mode);
      setOfflineReady(true);
    }

    async function loadContent() {
      setLoading(!cached);
      try {
        const [topicsRes, bundleRes] = await Promise.all([fetchTopics(lang), fetchBundle(lang)]);
        if (!active) return;
        setTopics(topicsRes.topics);
        setDemoMode(topicsRes.demo_mode || bundleRes.demo_mode);
        setBundle(bundleRes);
        saveCachedBundle(bundleRes);

        setCachingOffline(true);
        const ok = await precacheBundleAudio(bundleRes, cached?.version_hash ?? null);
        if (active) {
          setCachingOffline(false);
          setOfflineReady(ok || Boolean(cached));
        }
      } catch {
        if (active && cached) {
          setOfflineReady(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadContent();
    return () => {
      active = false;
    };
  }, [lang]);

  const handleSelectLanguage = (nextLang: Lang) => {
    setLang(nextLang);
    setHasChosenLang(true);
    setVoiceError(null);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore
    }
    setScreen({ name: "home" });
  };

  const handleToggleAutoplay = () => {
    setAutoplayEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(next));
      } catch {
        // Ignore
      }
      if (!next) audio.stop();
      return next;
    });
  };

  const handleOpenQuestion = async (faqId: number) => {
    audio.stop();
    if (bundle) {
      for (const tp of bundle.topics) {
        const item = tp.items.find((i) => i.faq_id === faqId);
        if (item) {
          const disclaimer = bundle.system_messages?.disclaimer;
          setScreen({
            name: "answer",
            payload: {
              faq_id: item.faq_id,
              intent_key: item.intent_key,
              topic_slug: tp.slug,
              topic_name: tp.name,
              lang,
              question: item.question,
              answer_text: item.answer_text,
              question_audio_url: item.question_audio_url,
              answer_audio_url: item.answer_audio_url,
              source_reference: item.source_reference,
              disclaimer_text: disclaimer?.text,
              disclaimer_audio_url: disclaimer?.audio_url ?? null,
              demo_mode: bundle.demo_mode,
              log_id: null
            }
          });
          if (!isOffline) {
            fetchAnswer(faqId, lang)
              .then((fresh) => {
                setScreen((curr) =>
                  curr.name === "answer" && curr.payload.faq_id === faqId
                    ? { name: "answer", payload: fresh }
                    : curr
                );
              })
              .catch(() => {});
          }
          return;
        }
      }
    }

    const payload = await fetchAnswer(faqId, lang);
    setScreen({ name: "answer", payload });
  };

  const handlePlayQuestionAudio = (q: QuestionSummary) => {
    audio.playSequence([q.question_audio_url]);
  };

  if (screen.name === "admin") {
    return (
      <Suspense fallback={<div className="p-6 text-ink">{t(lang, "loading")}</div>}>
        <AdminPortal
          onExit={() => {
            if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
              window.history.pushState({}, "", "/");
            }
            setScreen(hasChosenLang ? { name: "home" } : { name: "welcome" });
          }}
        />
      </Suspense>
    );
  }

  if (screen.name === "red_flag") {
    return (
      <RedFlagAlertView
        lang={lang}
        messageText={screen.messageText}
        messageAudioUrl={screen.messageAudioUrl}
        clinics={screen.clinics}
        autoplayEnabled={autoplayEnabled}
        onPlayClip={(url) => audio.playSequence([url])}
        onDismiss={() => {
          audio.stop();
          setScreen({ name: "home" });
        }}
      />
    );
  }

  const currentTopic =
    screen.name === "topic" ? topics.find((tp) => tp.slug === screen.slug) : undefined;

  return (
    <div className="min-h-screen bg-ground text-ink flex flex-col">
      <header className="bg-viridian text-white border-b border-viridian-hover">
        <div className="max-w-3xl mx-auto px-4 min-h-[56px] py-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              audio.stop();
              setScreen(hasChosenLang ? { name: "home" } : { name: "welcome" });
            }}
            aria-label={t(lang, "appName")}
            className="min-h-[48px] px-2 flex items-center gap-2 font-bold text-lg tracking-tight rounded-lg hover:bg-viridian-hover transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
            <span>{t(lang, "appName")}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center rounded-lg bg-viridian-hover p-1"
              role="group"
              aria-label={t(lang, "welcomeTitle")}
            >
              {(["yo", "pcm", "en"] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleSelectLanguage(code)}
                  aria-label={code === "pcm" ? "Nigerian Pidgin" : code.toUpperCase()}
                  aria-pressed={lang === code}
                  className={`min-h-[40px] min-w-[40px] px-2.5 rounded-md text-xs font-bold uppercase transition-colors ${
                    lang === code
                      ? "bg-white text-viridian"
                      : "text-emerald-100 hover:text-white"
                  }`}
                >
                  {code === "pcm" ? "PIDGIN" : code}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleToggleAutoplay}
              aria-label={autoplayEnabled ? t(lang, "autoplayOn") : t(lang, "autoplayOff")}
              title={autoplayEnabled ? t(lang, "autoplayOn") : t(lang, "autoplayOff")}
              className="min-h-[48px] min-w-[48px] px-2.5 rounded-lg hover:bg-viridian-hover flex items-center justify-center transition-colors"
            >
              {autoplayEnabled ? (
                <VolumeIcon className="w-5 h-5" />
              ) : (
                <VolumeMutedIcon className="w-5 h-5 text-emerald-200" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                audio.stop();
                setScreen({ name: "about" });
              }}
              aria-label={t(lang, "aboutLink")}
              className="min-h-[48px] px-3 rounded-lg text-sm font-semibold hover:bg-viridian-hover transition-colors"
            >
              {t(lang, "aboutLink")}
            </button>

            <button
              type="button"
              onClick={() => {
                audio.stop();
                setScreen({ name: "admin" });
              }}
              aria-label={t(lang, "staffLink")}
              className="min-h-[48px] px-3 rounded-lg text-sm font-semibold text-emerald-100 hover:text-white hover:bg-viridian-hover transition-colors"
            >
              {t(lang, "staffLink")}
            </button>
          </div>
        </div>
      </header>

      {demoMode && <DemoBanner lang={lang} />}

      <div className="bg-subtle border-b border-seam px-4 py-1.5 text-xs font-medium text-ink-muted">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            {isOffline ? (
              <>
                <WifiOffIcon className="w-4 h-4 text-ochre" />
                <span className="text-ochre font-semibold">{t(lang, "offlineActive")}</span>
              </>
            ) : cachingOffline ? (
              <>
                <CheckCircleIcon className="w-4 h-4 text-ink-muted" />
                <span>{t(lang, "offlineCaching")}</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4 text-viridian" />
                <span>{offlineReady ? t(lang, "offlineReady") : t(lang, "offlineCaching")}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex-1">
        {screen.name === "welcome" && (
          <LanguagePicker
            currentLang={hasChosenLang ? lang : null}
            welcomeAudioByLang={welcomeAudioByLang}
            consentAudioByLang={consentAudioByLang}
            onSelect={handleSelectLanguage}
            onPlayClip={(url) => audio.playSequence([url])}
          />
        )}

        {screen.name === "home" && (
          <HomeView
            lang={lang}
            topics={topics}
            loading={loading}
            isOffline={isOffline}
            isRecording={recorder.isRecording}
            recordingSeconds={recorder.recordingSeconds}
            isSubmittingVoice={isSubmittingVoice}
            voiceError={voiceError || recorder.micError}
            onStartRecording={recorder.startRecording}
            onStopRecording={recorder.stopRecording}
            onCancelRecording={recorder.cancelRecording}
            onSubmitTypedText={handleTypedQuestion}
            onSelectTopic={(slug) => {
              audio.stop();
              setScreen({ name: "topic", slug });
            }}
          />
        )}

        {screen.name === "topic" && currentTopic && (
          <TopicDetailView
            lang={lang}
            topic={currentTopic}
            onBack={() => {
              audio.stop();
              setScreen({ name: "home" });
            }}
            onSelectQuestion={handleOpenQuestion}
            onPlayQuestionAudio={handlePlayQuestionAudio}
          />
        )}

        {screen.name === "answer" && (
          <AnswerView
            lang={lang}
            answer={screen.payload}
            autoplayEnabled={autoplayEnabled}
            isPlaying={audio.isPlaying}
            playbackRate={audio.playbackRate}
            onPlayAnswerSequence={(aUrl, dUrl) => audio.playSequence([aUrl, dUrl])}
            onToggleSpeed={audio.toggleSpeed}
            onFeedback={async (rating) => {
              await sendFeedback({
                log_id: screen.payload.log_id,
                faq_id: screen.payload.faq_id,
                lang,
                rating
              });
            }}
            onResetHome={() => {
              audio.stop();
              setScreen({ name: "home" });
            }}
          />
        )}

        {screen.name === "unsure" && (
          <UnsureView
            lang={lang}
            messageText={screen.messageText}
            messageAudioUrl={screen.messageAudioUrl}
            candidates={screen.candidates}
            autoplayEnabled={autoplayEnabled}
            onPlayClip={(url) => audio.playSequence([url])}
            onSelectCandidate={handleOpenQuestion}
            onBackHome={() => {
              audio.stop();
              setScreen({ name: "home" });
            }}
          />
        )}

        {screen.name === "about" && (
          <AboutView
            lang={lang}
            meta={
              bundle?.meta || {
                content_last_updated: "2026-11-16",
                clinical_reviewers: "Dr. Adebayo O. & Clinical Review Team",
                language_reviewers: "Yorùbá & Nigerian Pidgin Linguistic Team"
              }
            }
            onBack={() => {
              audio.stop();
              setScreen({ name: "home" });
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
