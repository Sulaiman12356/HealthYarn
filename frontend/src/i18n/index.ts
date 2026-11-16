import en from "./en.json";
import yo from "./yo.json";
import pcm from "./pcm.json";
import type { Lang } from "../types";

export type TranslationKeys = keyof typeof en;

const DICTS: Record<Lang, typeof en> = {
  en,
  yo,
  pcm
};

export function t(lang: Lang, key: TranslationKeys): string {
  return DICTS[lang]?.[key] || en[key];
}

export const LANGUAGE_OPTIONS: Array<{
  code: Lang;
  nativeLabel: string;
  englishHint: string;
}> = [
  { code: "yo", nativeLabel: "Yorùbá", englishHint: "Èdè Yorùbá" },
  { code: "pcm", nativeLabel: "Nigerian Pidgin", englishHint: "Pidgin English" },
  { code: "en", nativeLabel: "English", englishHint: "Nigerian English" }
];
