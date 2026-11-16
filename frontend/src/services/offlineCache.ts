import type { BundleResponse, Lang, TopicSummary } from "../types";

const BUNDLE_KEY_PREFIX = "healthyarn_bundle_v1_";
const AUDIO_CACHE_NAME = "healthyarn-audio-v1";

export function getCachedBundle(lang: Lang): BundleResponse | null {
  try {
    const raw = localStorage.getItem(`${BUNDLE_KEY_PREFIX}${lang}`);
    if (!raw) return null;
    return JSON.parse(raw) as BundleResponse;
  } catch {
    return null;
  }
}

export function saveCachedBundle(bundle: BundleResponse): void {
  try {
    localStorage.setItem(`${BUNDLE_KEY_PREFIX}${bundle.lang}`, JSON.stringify(bundle));
  } catch {
    // Storage quota full or unavailable
  }
}

export function bundleToTopicSummaries(bundle: BundleResponse): TopicSummary[] {
  return bundle.topics.map((tp) => ({
    id: tp.id,
    slug: tp.slug,
    icon: tp.icon,
    sort_order: tp.sort_order,
    name: tp.name,
    description: tp.description,
    questions: tp.items.map((item) => ({
      faq_id: item.faq_id,
      intent_key: item.intent_key,
      question: item.question,
      question_audio_url: item.question_audio_url
    }))
  }));
}

export async function precacheBundleAudio(
  bundle: BundleResponse,
  previousHash: string | null
): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return false;
  }
  if (previousHash === bundle.version_hash && bundle.audio_urls.length > 0) {
    return true;
  }

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const urls = bundle.audio_urls.filter(Boolean);
    const batchSize = 6;
    for (let i = 0; i < urls.length; i += batchSize) {
      const slice = urls.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (url) => {
          const hit = await cache.match(url);
          if (!hit) {
            const resp = await fetch(url);
            if (resp.ok) {
              await cache.put(url, resp);
            }
          }
        })
      );
    }
    return true;
  } catch {
    return false;
  }
}
