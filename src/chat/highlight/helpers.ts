import type { TokenKind, Token, LangSpec } from "./types";

export function normalizeLang(raw: string): string {
  const lang = raw.trim().toLowerCase();
  if (!lang) return "plain";
  const aliases: Record<string, string> = {
    ts: "ts", typescript: "ts", tsx: "ts", js: "ts", javascript: "ts", jsx: "ts", mjs: "ts",
    cjs: "ts", mts: "ts", cts: "ts",
    rs: "rust", rust: "rust",
    py: "python", python: "python", python3: "python",
    go: "go", golang: "go",
    json: "json", jsonc: "json", json5: "json",
    sh: "shell", bash: "shell", zsh: "shell", shell: "shell", console: "shell", fish: "shell",
    sql: "sql", postgres: "sql", postgresql: "sql", mysql: "sql", sqlite: "sql",
    css: "css", scss: "css", less: "css",
    yml: "yaml", yaml: "yaml",
    diff: "diff", patch: "diff",
    html: "html", htm: "html", xml: "html", svg: "html", vue: "html",
  };
  return aliases[lang] ?? "plain";
}

export function merge(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const token of tokens) {
    if (!token.text) continue;
    const last = out[out.length - 1];
    if (last && last.kind === token.kind) last.text += token.text;
    else out.push({ ...token });
  }
  return out;
}

export function isIdentStart(char: string): boolean {
  return /[A-Za-z_$@]/.test(char);
}

export function isIdentPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}

export function consumeString(
  code: string,
  start: number,
  quote: string,
): number {
  let i = start + quote.length;
  while (i < code.length) {
    if (code.startsWith(quote, i)) return i + quote.length;
    if (code[i] === "\\") {
      i += 2;
      continue;
    }
    i += 1;
  }
  return code.length;
}

export function classifyWord(
  word: string,
  nextNonSpace: string,
  spec: LangSpec,
): TokenKind {
  const lookup = spec.caseInsensitive ? word.toLowerCase() : word;
  const keywords = spec.caseInsensitive ? spec.keywords.map((k) => k.toLowerCase()) : spec.keywords;
  const types = spec.caseInsensitive ? spec.types.map((t) => t.toLowerCase()) : spec.types;
  if (keywords.includes(lookup)) return "keyword";
  if (types.includes(lookup)) return "type";
  if (spec.upperIsType && /^[A-Z]/.test(word) && !word.includes("_")) return "type";
  if (nextNonSpace === "(") return "function";
  return "plain";
}
