import React, { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { BrandLogo } from "./BrandSvg";
import { SiteHeader, type NavRoute } from "./SiteHeader";
import { CheckCircleIcon, EyeIcon, EyeOffIcon, ShieldCheckIcon } from "./Icons";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "editor" | "clinical_reviewer" | "language_reviewer" | "admin";
}

interface AdminTranslation {
  id: number;
  lang: "en" | "yo" | "pcm";
  question_text: string;
  answer_text: string;
  question_audio_url: string | null;
  answer_audio_url: string | null;
  available_takes: string[];
  voice_name: string | null;
  status: "draft" | "clinical_ok" | "language_ok" | "published";
  review_comment: string | null;
  regen_requested: boolean;
  has_placeholder: boolean;
  samples: string[];
}

interface AdminItem {
  id: number;
  topic_id: number;
  topic_slug: string;
  topic_name: string;
  intent_key: string;
  source_reference: string;
  is_active: boolean;
  translations: Partial<Record<"en" | "yo" | "pcm", AdminTranslation>>;
}

interface AdminStats {
  total_queries: number;
  red_flag_count: number;
  by_lang: Record<string, number>;
  by_outcome: Record<string, number>;
  by_topic: Record<string, number>;
  thumbs_by_faq: Array<{ faq_id: number; intent_key: string; up: number; down: number }>;
  lowest_confidence_unsure: Array<{
    id: number;
    lang: string;
    confidence: number | null;
    unmatched_text: string | null;
    created_at: string;
  }>;
  audit_logs: Array<{
    id: number;
    user_name: string;
    action: string;
    entity: string;
    entity_id: number;
    details: string | null;
    timestamp: string;
  }>;
}

interface RedFlagRow {
  id: number;
  lang: string;
  pattern: string;
  severity: string;
  status: string;
}

function readCsrfCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)healthyarn_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-subtle text-ink border-seam",
  clinical_ok: "bg-ochre-bg text-ochre border-ochre-border",
  language_ok: "bg-sky-50 text-sky-900 border-sky-300",
  published: "bg-viridian-soft text-viridian border-viridian"
};

interface AdminPortalProps {
  onExit: () => void;
  onNavigateRoute?: (route: NavRoute) => void;
  lang?: Lang;
  onSelectLang?: (lang: Lang) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onExit,
  onNavigateRoute,
  lang = "en",
  onSelectLang = () => {}
}) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<"content" | "redflags" | "stats" | "users">("content");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [topics, setTopics] = useState<Array<{ id: number; slug: string; name_en: string }>>([]);
  const [filterTopic, setFilterTopic] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<"en" | "yo" | "pcm">("en");
  const [draftEdits, setDraftEdits] = useState<
    Record<"en" | "yo" | "pcm", { question_text: string; answer_text: string; samplesText: string }>
  >({
    en: { question_text: "", answer_text: "", samplesText: "" },
    yo: { question_text: "", answer_text: "", samplesText: "" },
    pcm: { question_text: "", answer_text: "", samplesText: "" }
  });
  const [editSourceRef, setEditSourceRef] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [selectedTake, setSelectedTake] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [redFlags, setRedFlags] = useState<RedFlagRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersList, setUsersList] = useState<Array<AdminUser & { is_active: boolean }>>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "editor" as AdminUser["role"]
  });

  const adminFetch = useCallback(
    async (url: string, opts: RequestInit = {}) => {
      const token = csrfToken || readCsrfCookie();
      const headers = new Headers(opts.headers || {});
      if (opts.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (opts.method && opts.method !== "GET") {
        headers.set("X-CSRF-Token", token);
      }
      const res = await fetch(url, {
        ...opts,
        headers,
        credentials: "include"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(err.detail || "Request failed");
      }
      return res.json();
    },
    [csrfToken]
  );

  const loadContent = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterTopic) params.set("topic_slug", filterTopic);
    if (filterLang) params.set("lang", filterLang);
    if (filterStatus) params.set("status", filterStatus);
    const data = await adminFetch(`/api/admin/items?${params.toString()}`);
    setTopics(data.topics || []);
    setItems(data.items || []);
  }, [adminFetch, filterLang, filterStatus, filterTopic]);

  const loadStats = useCallback(async () => {
    const data = await adminFetch("/api/admin/stats");
    setStats(data);
  }, [adminFetch]);

  const loadRedFlags = useCallback(async () => {
    const data = await adminFetch("/api/admin/red-flags");
    setRedFlags(data.rules || []);
  }, [adminFetch]);

  const loadUsers = useCallback(async () => {
    const data = await adminFetch("/api/admin/users");
    setUsersList(data.users || []);
  }, [adminFetch]);

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          setCsrfToken(data.csrf_token || readCsrfCookie());
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tab === "content") loadContent().catch(() => {});
    if (tab === "stats") loadStats().catch(() => {});
    if (tab === "redflags") loadRedFlags().catch(() => {});
    if (tab === "users" && user.role === "admin") loadUsers().catch(() => {});
  }, [loadContent, loadRedFlags, loadStats, loadUsers, tab, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Login failed");
      }
      const data = await res.json();
      setUser(data.user);
      setCsrfToken(data.csrf_token || readCsrfCookie());
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleLogout = async () => {
    await adminFetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setEditingItem(null);
  };

  const openEditor = (item: AdminItem) => {
    setEditingItem(item);
    setActiveLangTab("en");
    setEditSourceRef(item.source_reference || "");
    setReviewComment("");
    setActionMsg(null);
    const nextEdits = {
      en: {
        question_text: item.translations.en?.question_text || "",
        answer_text: item.translations.en?.answer_text || "",
        samplesText: (item.translations.en?.samples || []).join("\n")
      },
      yo: {
        question_text: item.translations.yo?.question_text || "",
        answer_text: item.translations.yo?.answer_text || "",
        samplesText: (item.translations.yo?.samples || []).join("\n")
      },
      pcm: {
        question_text: item.translations.pcm?.question_text || "",
        answer_text: item.translations.pcm?.answer_text || "",
        samplesText: (item.translations.pcm?.samples || []).join("\n")
      }
    };
    setDraftEdits(nextEdits);
    setSelectedTake(item.translations.en?.answer_audio_url || "");
  };

  const saveDraftEdits = async () => {
    if (!editingItem) return;
    setActionMsg(null);
    try {
      await adminFetch(`/api/admin/items/${editingItem.id}`, {
        method: "PUT",
        body: JSON.stringify({
          source_reference: editSourceRef,
          translations: {
            en: {
              question_text: draftEdits.en.question_text,
              answer_text: draftEdits.en.answer_text,
              samples: draftEdits.en.samplesText.split("\n").map((s) => s.trim()).filter(Boolean)
            },
            yo: {
              question_text: draftEdits.yo.question_text,
              answer_text: draftEdits.yo.answer_text,
              samples: draftEdits.yo.samplesText.split("\n").map((s) => s.trim()).filter(Boolean)
            },
            pcm: {
              question_text: draftEdits.pcm.question_text,
              answer_text: draftEdits.pcm.answer_text,
              samples: draftEdits.pcm.samplesText.split("\n").map((s) => s.trim()).filter(Boolean)
            }
          }
        })
      });
      await loadContent();
      setActionMsg("Saved changes (status reset to draft for review).");
      setEditingItem(null);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Save failed");
    }
  };

  const runReviewAction = async (
    trId: number,
    endpoint: "clinical-review" | "language-review" | "publish" | "regen",
    payload?: object
  ) => {
    setActionMsg(null);
    try {
      await adminFetch(`/api/admin/translations/${trId}/${endpoint}`, {
        method: "POST",
        body: payload ? JSON.stringify(payload) : "{}"
      });
      await loadContent();
      setActionMsg(`Action '${endpoint}' completed.`);
      setEditingItem(null);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Action failed");
    }
  };

  const activeTr = editingItem?.translations[activeLangTab];

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-ground p-6 text-ink">
        <p>Checking staff session…</p>
      </div>
    );
  }

  const navigateTo = (route: NavRoute) => {
    if (onNavigateRoute) {
      onNavigateRoute(route);
      return;
    }
    onExit();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-hy-cream text-hy-ink flex flex-col">
        <SiteHeader
          activeRoute="admin"
          lang={lang}
          onSelectLang={onSelectLang}
          onNavigate={navigateTo}
        />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Governance Panel */}
            <aside className="lg:col-span-6 bg-hy-green text-white rounded-card p-7 sm:p-8 shadow-soft flex flex-col justify-between gap-6">
              <div>
                <div className="mb-5">
                  <BrandLogo variant="onGreen" markSize="w-9 h-9" textSize="text-xl" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
                  Clinical &amp; Language Governance Portal
                </h1>
                <p className="text-base text-hy-cream leading-relaxed prose-measure mb-6">
                  Every HealthYarn question, translation, and voice clip passes four-eyes human
                  review before public citizens ever hear it.
                </p>

                <ul className="space-y-3 text-sm sm:text-base text-hy-cream">
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Content Editor:</strong> drafts &amp; updates
                      WHO/FMOH FAQ answers and resets modified items to draft.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Clinical Reviewer:</strong> verifies medical
                      accuracy and approves English source copy &amp; red-flag rules.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Language Reviewer:</strong> checks Yorùbá tone
                      marks and everyday Nigerian Pidgin phrasing before audio take selection.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheckIcon className="w-5 h-5 text-hy-amber shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Admin Guardrail:</strong> publishes verified
                      guidance and blocks unreviewed or placeholder copy.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-white/15 flex flex-wrap gap-3 text-sm font-bold">
                <button
                  type="button"
                  onClick={() => navigateTo("landing")}
                  className="min-h-[44px] px-4 rounded-full bg-hy-forest text-hy-cream hover:bg-white hover:text-hy-forest transition-colors"
                >
                  ← {t(lang, "navOverview")}
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("app")}
                  className="min-h-[44px] px-4 rounded-full bg-hy-amber text-hy-ink hover:bg-amber-hover transition-colors"
                >
                  {t(lang, "navVoiceApp")}
                </button>
              </div>
            </aside>

            {/* Right Accessible Sign In Form */}
            <section className="lg:col-span-6 bg-white border border-seam rounded-card p-7 sm:p-8 shadow-soft flex flex-col justify-center">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-extrabold text-hy-ink">Staff Sign In</h2>
                  <p className="text-sm text-hy-muted mt-1">
                    Sign in with your assigned clinical, language, or administrator account.
                  </p>
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="bg-crimson-soft text-crimson border border-crimson rounded-lg p-3.5 text-sm font-semibold"
                  >
                    {authError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="admin-email"
                    className="block text-sm font-bold text-hy-ink mb-1.5"
                  >
                    Work email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@healthyarn.ng"
                    className="w-full min-h-[48px] px-3.5 rounded-lg bg-ground border border-seam text-hy-ink placeholder:text-hy-muted"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-sm font-bold text-hy-ink mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[48px] pl-3.5 pr-12 rounded-lg bg-ground border border-seam text-hy-ink"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t(lang, "hidePassword") : t(lang, "showPassword")}
                      className="absolute right-1 min-w-[44px] min-h-[44px] rounded-lg text-hy-muted hover:text-hy-green flex items-center justify-center"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[50px] rounded-full bg-hy-green text-white font-extrabold hover:bg-hy-forest transition-colors"
                >
                  Sign in
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="bg-viridian text-white border-b border-viridian-hover">
        <div className="max-w-6xl mx-auto px-4 min-h-[60px] py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigateTo("landing")}
              aria-label={t(lang, "appName")}
              className="min-h-[44px] inline-flex items-center rounded-lg pr-2 hover:bg-viridian-hover transition-colors"
            >
              <BrandLogo variant="onGreen" markSize="w-7 h-7" textSize="text-lg" />
            </button>
            <span className="rounded-full bg-viridian-hover px-3 py-1 text-xs font-extrabold text-hy-cream">
              Staff Portal
            </span>
            <nav aria-label="Quick site links" className="flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => navigateTo("landing")}
                className="min-h-[40px] px-3 rounded-full text-hy-cream hover:bg-viridian-hover hover:text-white font-semibold"
              >
                {t(lang, "navOverview")}
              </button>
              <button
                type="button"
                onClick={() => navigateTo("app")}
                className="min-h-[40px] px-3 rounded-full text-hy-cream hover:bg-viridian-hover hover:text-white font-semibold"
              >
                {t(lang, "navVoiceApp")}
              </button>
              <button
                type="button"
                onClick={() => navigateTo("about")}
                className="min-h-[40px] px-3 rounded-full text-hy-cream hover:bg-viridian-hover hover:text-white font-semibold"
              >
                {t(lang, "navAbout")}
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-hy-cream">
              {user.name} (<span className="font-bold text-white">{user.role}</span>)
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] px-4 rounded-full bg-white text-viridian font-bold text-sm hover:bg-hy-sand transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <nav className="flex flex-wrap gap-2 border-b border-seam pb-3" aria-label="Staff navigation">
            {(
              [
                ["content", "Content"],
                ["redflags", "Red-Flag Rules"],
                ["stats", "Stats & Audit"],
                ...(user.role === "admin" ? [["users", "Users & Clinics"]] : [])
              ] as Array<[typeof tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  tab === key
                    ? "bg-viridian text-white border-viridian"
                    : "bg-surface text-ink border-seam hover:bg-subtle"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {actionMsg && (
            <div role="status" className="bg-viridian-soft border border-viridian text-viridian rounded-xl px-4 py-3 text-sm font-semibold">
              {actionMsg}
            </div>
          )}

          {tab === "content" && (
            <div className="space-y-4">
              <div className="bg-surface border border-seam rounded-xl p-4 flex flex-wrap gap-3">
                <select
                  aria-label="Filter by topic"
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  className="min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm font-semibold"
                >
                  <option value="">All topics</option>
                  {topics.map((tp) => (
                    <option key={tp.id} value={tp.slug}>
                      {tp.name_en}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by language"
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm font-semibold"
                >
                  <option value="">All languages</option>
                  <option value="en">English (en)</option>
                  <option value="yo">Yorùbá (yo)</option>
                  <option value="pcm">Nigerian Pidgin (pcm)</option>
                </select>
                <select
                  aria-label="Filter by status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm font-semibold"
                >
                  <option value="">All statuses</option>
                  <option value="draft">draft</option>
                  <option value="clinical_ok">clinical_ok</option>
                  <option value="language_ok">language_ok</option>
                  <option value="published">published</option>
                </select>
              </div>

              {editingItem && (
                <section className="bg-surface border border-viridian rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold text-ink">
                      Edit: {editingItem.intent_key}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="min-h-[40px] px-3 rounded-lg border border-seam text-sm font-semibold"
                    >
                      Close
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Source Reference</label>
                    <input
                      type="text"
                      value={editSourceRef}
                      onChange={(e) => setEditSourceRef(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                    />
                  </div>

                  <div className="flex gap-2 border-b border-seam pb-2">
                    {(["en", "yo", "pcm"] as const).map((lc) => {
                      const tr = editingItem.translations[lc];
                      return (
                        <button
                          key={lc}
                          type="button"
                          onClick={() => {
                            setActiveLangTab(lc);
                            setSelectedTake(tr?.answer_audio_url || "");
                          }}
                          className={`min-h-[44px] px-4 rounded-lg text-sm font-bold border ${
                            activeLangTab === lc
                              ? "bg-viridian text-white border-viridian"
                              : "bg-ground text-ink border-seam"
                          }`}
                        >
                          {lc.toUpperCase()} ({tr?.status || "none"})
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Question Text</label>
                      <input
                        type="text"
                        value={draftEdits[activeLangTab].question_text}
                        onChange={(e) =>
                          setDraftEdits((prev) => ({
                            ...prev,
                            [activeLangTab]: { ...prev[activeLangTab], question_text: e.target.value }
                          }))
                        }
                        className="w-full min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Answer Text</label>
                      <textarea
                        rows={4}
                        value={draftEdits[activeLangTab].answer_text}
                        onChange={(e) =>
                          setDraftEdits((prev) => ({
                            ...prev,
                            [activeLangTab]: { ...prev[activeLangTab], answer_text: e.target.value }
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-ground border border-seam text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        Sample Phrasings (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={draftEdits[activeLangTab].samplesText}
                        onChange={(e) =>
                          setDraftEdits((prev) => ({
                            ...prev,
                            [activeLangTab]: { ...prev[activeLangTab], samplesText: e.target.value }
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-ground border border-seam text-sm"
                      />
                    </div>
                  </div>

                  {activeTr && (
                    <div className="bg-subtle border border-seam rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          Audio Preview ({activeTr.voice_name || "default"})
                        </span>
                        <button
                          type="button"
                          onClick={() => runReviewAction(activeTr.id, "regen")}
                          className="min-h-[40px] px-3 rounded-lg bg-surface border border-seam text-xs font-bold"
                        >
                          {activeTr.regen_requested ? "Regen Queued" : "Regenerate Audio"}
                        </button>
                      </div>
                      {activeTr.answer_audio_url && (
                        <audio controls src={selectedTake || activeTr.answer_audio_url} className="w-full" />
                      )}
                      {activeTr.available_takes.length > 1 && (
                        <div>
                          <label className="block text-xs font-semibold mb-1">Select Take</label>
                          <select
                            value={selectedTake || activeTr.answer_audio_url || ""}
                            onChange={(e) => setSelectedTake(e.target.value)}
                            className="min-h-[40px] px-2 rounded border border-seam bg-surface text-xs"
                          >
                            {activeTr.available_takes.map((takeUrl, idx) => (
                              <option key={takeUrl} value={takeUrl}>
                                Take {idx + 1}: {takeUrl.split("/").pop()}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-seam">
                    {(user.role === "editor" || user.role === "admin") && (
                      <button
                        type="button"
                        onClick={saveDraftEdits}
                        className="min-h-[44px] px-4 rounded-lg bg-viridian text-white text-sm font-bold"
                      >
                        Save Draft
                      </button>
                    )}

                    {activeTr && user.role === "clinical_reviewer" && (
                      <>
                        <input
                          type="text"
                          placeholder="Review comment (optional)"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            runReviewAction(activeTr.id, "clinical-review", {
                              approved: true,
                              comment: reviewComment
                            })
                          }
                          className="min-h-[44px] px-4 rounded-lg bg-viridian text-white text-sm font-bold"
                        >
                          Clinical Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runReviewAction(activeTr.id, "clinical-review", {
                              approved: false,
                              comment: reviewComment
                            })
                          }
                          className="min-h-[44px] px-4 rounded-lg bg-crimson text-white text-sm font-bold"
                        >
                          Clinical Reject
                        </button>
                      </>
                    )}

                    {activeTr && user.role === "language_reviewer" && (
                      <>
                        <input
                          type="text"
                          placeholder="Language comment (optional)"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            runReviewAction(activeTr.id, "language-review", {
                              approved: true,
                              comment: reviewComment,
                              selected_audio_url: selectedTake || undefined
                            })
                          }
                          className="min-h-[44px] px-4 rounded-lg bg-viridian text-white text-sm font-bold"
                        >
                          Language Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runReviewAction(activeTr.id, "language-review", {
                              approved: false,
                              comment: reviewComment
                            })
                          }
                          className="min-h-[44px] px-4 rounded-lg bg-crimson text-white text-sm font-bold"
                        >
                          Language Reject
                        </button>
                      </>
                    )}

                    {activeTr && user.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => runReviewAction(activeTr.id, "publish")}
                        className="min-h-[44px] px-4 rounded-lg bg-ochre text-white text-sm font-bold"
                      >
                        Publish ({activeLangTab.toUpperCase()})
                      </button>
                    )}
                  </div>
                </section>
              )}

              <div className="bg-surface border border-seam rounded-xl overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-subtle border-b border-seam text-ink-muted">
                    <tr>
                      <th className="p-3 font-bold">Intent Key</th>
                      <th className="p-3 font-bold">Topic</th>
                      <th className="p-3 font-bold">EN</th>
                      <th className="p-3 font-bold">YO</th>
                      <th className="p-3 font-bold">PCM</th>
                      <th className="p-3 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-seam last:border-b-0">
                        <td className="p-3 font-semibold text-ink">{item.intent_key}</td>
                        <td className="p-3 text-ink-muted">{item.topic_name}</td>
                        {(["en", "yo", "pcm"] as const).map((lc) => {
                          const tr = item.translations[lc];
                          const st = tr?.status || "missing";
                          return (
                            <td key={lc} className="p-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${
                                  STATUS_BADGE[st] || STATUS_BADGE.draft
                                }`}
                              >
                                {st}
                              </span>
                            </td>
                          );
                        })}
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => openEditor(item)}
                            className="min-h-[40px] px-3 rounded-lg bg-viridian-soft text-viridian font-bold text-xs"
                          >
                            Inspect / Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "redflags" && (
            <div className="bg-surface border border-seam rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-subtle border-b border-seam text-ink-muted">
                  <tr>
                    <th className="p-3 font-bold">Lang</th>
                    <th className="p-3 font-bold">Pattern</th>
                    <th className="p-3 font-bold">Status</th>
                    <th className="p-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {redFlags.map((rf) => (
                    <tr key={rf.id} className="border-b border-seam last:border-b-0">
                      <td className="p-3 font-bold uppercase">{rf.lang}</td>
                      <td className="p-3 font-mono text-xs">{rf.pattern}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${
                            STATUS_BADGE[rf.status] || STATUS_BADGE.draft
                          }`}
                        >
                          {rf.status}
                        </span>
                      </td>
                      <td className="p-3 flex gap-2">
                        {user.role === "clinical_reviewer" && (
                          <button
                            type="button"
                            onClick={() =>
                              adminFetch(`/api/admin/red-flags/${rf.id}/clinical-review`, {
                                method: "POST",
                                body: JSON.stringify({ approved: true })
                              }).then(loadRedFlags)
                            }
                            className="min-h-[40px] px-3 rounded bg-viridian text-white text-xs font-bold"
                          >
                            Approve
                          </button>
                        )}
                        {user.role === "admin" && (
                          <button
                            type="button"
                            onClick={() =>
                              adminFetch(`/api/admin/red-flags/${rf.id}/publish`, {
                                method: "POST",
                                body: "{}"
                              })
                                .then(loadRedFlags)
                                .catch((e) => setActionMsg(e.message))
                            }
                            className="min-h-[40px] px-3 rounded bg-ochre text-white text-xs font-bold"
                          >
                            Publish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "stats" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface border border-seam rounded-xl p-4">
                  <div className="text-xs font-bold text-ink-muted">Total Queries</div>
                  <div className="text-2xl font-bold tabular-nums">{stats.total_queries}</div>
                </div>
                <div className="bg-surface border border-seam rounded-xl p-4">
                  <div className="text-xs font-bold text-ink-muted">Red Flags</div>
                  <div className="text-2xl font-bold text-crimson tabular-nums">
                    {stats.red_flag_count}
                  </div>
                </div>
                <div className="bg-surface border border-seam rounded-xl p-4">
                  <div className="text-xs font-bold text-ink-muted">By Language</div>
                  <div className="text-sm font-semibold tabular-nums mt-1">
                    {Object.entries(stats.by_lang)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "—"}
                  </div>
                </div>
                <div className="bg-surface border border-seam rounded-xl p-4">
                  <div className="text-xs font-bold text-ink-muted">Outcomes</div>
                  <div className="text-sm font-semibold tabular-nums mt-1">
                    {Object.entries(stats.by_outcome)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </div>

              <section className="bg-surface border border-seam rounded-xl p-4">
                <h2 className="text-lg font-bold mb-3">Recent Audit Trail</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-subtle border-b border-seam">
                      <tr>
                        <th className="p-2">Time</th>
                        <th className="p-2">User</th>
                        <th className="p-2">Action</th>
                        <th className="p-2">Entity</th>
                        <th className="p-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.audit_logs.map((a) => (
                        <tr key={a.id} className="border-b border-seam last:border-b-0">
                          <td className="p-2 tabular-nums">{a.timestamp}</td>
                          <td className="p-2 font-semibold">{a.user_name}</td>
                          <td className="p-2 font-mono">{a.action}</td>
                          <td className="p-2">
                            {a.entity} #{a.entity_id}
                          </td>
                          <td className="p-2 text-ink-muted">{a.details || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === "users" && user.role === "admin" && (
            <div className="grid md:grid-cols-2 gap-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await adminFetch("/api/admin/users", {
                      method: "POST",
                      body: JSON.stringify(newUser)
                    });
                    setNewUser({ name: "", email: "", password: "", role: "editor" });
                    await loadUsers();
                    setActionMsg("Staff user created.");
                  } catch (err) {
                    setActionMsg(err instanceof Error ? err.message : "Error");
                  }
                }}
                className="bg-surface border border-seam rounded-xl p-5 space-y-3"
              >
                <h2 className="text-lg font-bold">Add Staff Account</h2>
                <input
                  required
                  placeholder="Full name"
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  className="w-full min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                />
                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  className="w-full min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                />
                <input
                  required
                  minLength={10}
                  type="password"
                  placeholder="Password (min 10 chars)"
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  className="w-full min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm"
                />
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((u) => ({ ...u, role: e.target.value as AdminUser["role"] }))
                  }
                  className="w-full min-h-[44px] px-3 rounded-lg bg-ground border border-seam text-sm font-semibold"
                >
                  <option value="editor">editor</option>
                  <option value="clinical_reviewer">clinical_reviewer</option>
                  <option value="language_reviewer">language_reviewer</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-lg bg-viridian text-white text-sm font-bold"
                >
                  Create Staff Account
                </button>
              </form>

              <div className="bg-surface border border-seam rounded-xl p-5">
                <h2 className="text-lg font-bold mb-3">Staff Directory</h2>
                <ul className="space-y-2 text-sm">
                  {usersList.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between border-b border-seam pb-2"
                    >
                      <div>
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs text-ink-muted">{u.email}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-subtle border border-seam text-xs font-bold">
                        {u.role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </main>
    </div>
  );
};

export default AdminPortal;
