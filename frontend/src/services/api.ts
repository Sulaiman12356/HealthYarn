import type { AnswerPayload, BundleResponse, Clinic, Lang, TopicSummary } from "../types";

export interface MetaResponse {
  demo_mode: boolean;
  content_last_updated: string;
  clinical_reviewers: string;
  language_reviewers: string;
  welcome_audio?: Partial<Record<Lang, string | null>>;
  consent_audio?: Partial<Record<Lang, string | null>>;
}

export async function fetchMeta(): Promise<MetaResponse> {
  const res = await fetch("/api/meta");
  if (!res.ok) {
    throw new Error("Failed to fetch metadata");
  }
  return res.json();
}

export async function fetchTopics(lang: Lang): Promise<{ demo_mode: boolean; topics: TopicSummary[] }> {
  const res = await fetch(`/api/topics?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) {
    throw new Error("Failed to fetch topics");
  }
  return res.json();
}

export async function fetchAnswer(faqId: number, lang: Lang): Promise<AnswerPayload> {
  const res = await fetch(`/api/answers/${faqId}?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) {
    throw new Error("Failed to fetch answer");
  }
  return res.json();
}

export async function fetchBundle(lang: Lang): Promise<BundleResponse> {
  const res = await fetch(`/api/bundle?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) {
    throw new Error("Failed to fetch offline bundle");
  }
  return res.json();
}

export async function fetchClinics(state?: string): Promise<{ clinics: Clinic[] }> {
  const qs = state ? `?state=${encodeURIComponent(state)}` : "";
  const res = await fetch(`/api/clinics${qs}`);
  if (!res.ok) {
    throw new Error("Failed to fetch clinics");
  }
  return res.json();
}

export async function sendFeedback(payload: {
  log_id?: number | null;
  faq_id?: number;
  lang?: Lang;
  rating: 1 | -1;
}): Promise<void> {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
