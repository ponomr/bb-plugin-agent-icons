/**
 * Display language. The bb SDK exposes no user locale, so the language is a
 * plugin setting (`language`) that the server passes to the app in `state`.
 * English is the default; Russian is the secondary language.
 */
import { MAX_FILE_BYTES } from "./limits";

export const LANGUAGES = ["en", "ru"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/** Option labels of the language setting, each in its own language. */
export const LANGUAGE_LABELS: Record<Language, string> = { en: "English", ru: "Русский" };

/** Unknown or missing values fall back to English. */
export function parseLanguage(value: unknown): Language {
  return (LANGUAGES as readonly unknown[]).includes(value) ? (value as Language) : DEFAULT_LANGUAGE;
}

/** `1.5` in English, `1,5` in Russian; always one decimal. */
export function formatMegabytes(bytes: number, language: Language): string {
  const value = (bytes / (1024 * 1024)).toFixed(1);
  return language === "ru" ? value.replace(".", ",") : value;
}

const tooLarge: Record<Language, (limitKb: number, sizeKb: number) => string> = {
  en: (limitKb, sizeKb) => `file larger than ${limitKb} KB (${sizeKb} KB)`,
  ru: (limitKb, sizeKb) => `файл больше ${limitKb} КБ (${sizeKb} КБ)`,
};

/** Rejection reason for a file over `MAX_FILE_BYTES`; shared by the server, CLI and app. */
export function tooLargeReason(size: number, language: Language): string {
  return tooLarge[language](MAX_FILE_BYTES / 1024, Math.ceil(size / 1024));
}
