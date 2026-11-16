import en from "./en.json";
import yo from "./yo.json";
import ig from "./ig.json";
import type { Lang } from "../types";

export type TranslationKeys = keyof typeof en;

const DICTS: Record<Lang, typeof en> = {
  en,
  yo,
  ig
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
  { code: "ig", nativeLabel: "Igbo", englishHint: "Asụsụ Igbo" },
  { code: "en", nativeLabel: "English", englishHint: "Nigerian English" }
];
