export const PREF_CHAT_LANGUAGE = "chat_language";

export const CHAT_LANGUAGE_AUTO = "auto";

export const LANGUAGE_BLOCK = "LANGUAGE";

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hi: "Hindi",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ms: "Malay",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  zh: "Chinese",
};

export const CHAT_LANGUAGE_CHOICES: readonly string[] = [
  CHAT_LANGUAGE_AUTO,
  ...Object.keys(LANGUAGE_NAMES).sort(),
];

const SCRIPTS: readonly { readonly pattern: RegExp; readonly language: string }[] = [
  { pattern: /[\u0E00-\u0E7F]/u, language: "th" },
  { pattern: /[\u3040-\u30FF\u31F0-\u31FF]/u, language: "ja" },
  { pattern: /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u, language: "ko" },
  { pattern: /[\u0400-\u04FF]/u, language: "ru" },
  { pattern: /[\u0600-\u06FF]/u, language: "ar" },
  { pattern: /[\u0590-\u05FF]/u, language: "he" },
  { pattern: /[\u0370-\u03FF]/u, language: "el" },
  { pattern: /[\u0900-\u097F]/u, language: "hi" },
  { pattern: /[\u3400-\u4DBF\u4E00-\u9FFF]/u, language: "zh" },
  { pattern: /[A-Za-z\u00C0-\u024F]/u, language: "en" },
];

export function isChatLanguage(value: string): boolean {
  if (value === CHAT_LANGUAGE_AUTO) return true;
  const parts = value.split("-");
  if (parts.length > 2) return false;
  const language = parts[0] ?? "";
  if (!/^[a-z]{2}$/.test(language)) return false;
  const region = parts[1];
  if (region === undefined) return true;
  return /^[a-z0-9]{2,8}$/.test(region);
}

export function normalizeChatLanguage(value: string | null | undefined): string {
  const candidate = value ?? "";
  return isChatLanguage(candidate) ? candidate : CHAT_LANGUAGE_AUTO;
}

export function languageName(language: string): string {
  const base = language.split("-")[0] ?? "";
  return LANGUAGE_NAMES[base] ?? base;
}

const FENCE = /^\s*(`{3,}|~{3,})/;

export function proseOf(text: string | null | undefined): string {
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of (text ?? "").split("\n")) {
    const opening = FENCE.exec(line)?.[1] ?? null;
    if (fence === null) {
      if (opening) fence = opening[0];
      else kept.push(line);
    } else if (opening && opening[0] === fence) {
      fence = null;
    }
  }
  return kept.join("\n");
}

export function detectReplyLanguage(text: string | null | undefined): string | null {
  const sample = proseOf(text);
  for (const script of SCRIPTS) {
    if (script.pattern.test(sample)) return script.language;
  }
  return null;
}

export function resolveReplyLanguage(
  setting: string | null | undefined,
  sample?: string | null,
): string | null {
  const preferred = normalizeChatLanguage(setting);
  if (preferred !== CHAT_LANGUAGE_AUTO) return preferred;
  return detectReplyLanguage(sample);
}

export function chatLanguageDirective(
  setting: string | null | undefined,
  sample?: string | null,
): string {
  const preferred = normalizeChatLanguage(setting);
  if (preferred !== CHAT_LANGUAGE_AUTO) {
    const name = languageName(preferred);
    return `${LANGUAGE_BLOCK}\nReply in ${name} (${preferred}). That is the language the human keeps in Ponpoko's preferences, so it holds for this whole thread even when the thread's text is written in another language.`;
  }
  const detected = detectReplyLanguage(sample);
  if (detected) {
    const name = languageName(detected);
    return `${LANGUAGE_BLOCK}\nThe human's latest message is written in ${name} (${detected}) and the language preference is auto. Reply in ${name}, and follow the human the moment they switch.`;
  }
  return `${LANGUAGE_BLOCK}\nThe language preference is auto: reply in the language of the human's latest message, and follow them the moment they switch.`;
}
