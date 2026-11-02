import type { Token } from "./types";
import { LANGS } from "./langs";
import { normalizeLang, merge } from "./helpers";
import { scanGeneric } from "./generic";
import { scanYaml, scanDiff, scanHtml } from "./special";

export function computeHighlight(code: string, rawLang: string): Token[] {
  const lang = normalizeLang(rawLang);
  if (lang === "plain") return code ? [{ kind: "plain", text: code }] : [];
  let tokens: Token[];
  try {
    if (lang === "diff") tokens = scanDiff(code);
    else if (lang === "yaml") tokens = scanYaml(code);
    else if (lang === "html") tokens = scanHtml(code);
    else tokens = scanGeneric(code, LANGS[lang] ?? LANGS.plain!);
  } catch {
    tokens = [{ kind: "plain", text: code }];
  }
  return merge(tokens);
}

export const HIGHLIGHT_CACHE_LIMIT = 120;
export const highlightCache = new Map<string, Token[]>();

export function highlight(code: string, rawLang: string): Token[] {
  const key = `${rawLang}\u0000${code}`;
  const cached = highlightCache.get(key);
  if (cached) return cached;
  const tokens = computeHighlight(code, rawLang);
  if (highlightCache.size >= HIGHLIGHT_CACHE_LIMIT) {
    const oldest = highlightCache.keys().next().value;
    if (oldest !== undefined) highlightCache.delete(oldest);
  }
  highlightCache.set(key, tokens);
  return tokens;
}

export function clearHighlightCache(): void {
  highlightCache.clear();
}

export function tokenText(tokens: Token[]): string {
  return tokens.map((token) => token.text).join("");
}

export function languageLabel(raw: string): string {
  const lang = normalizeLang(raw);
  const labels: Record<string, string> = {
    ts: "TypeScript",
    rust: "Rust",
    python: "Python",
    go: "Go",
    json: "JSON",
    shell: "Shell",
    sql: "SQL",
    css: "CSS",
    yaml: "YAML",
    diff: "Diff",
    html: "HTML",
    plain: raw.trim() || "Text",
  };
  return labels[lang] ?? (raw.trim() || "Text");
}
