export interface PonpokoUIError {
  message: string;
  index: number;
  statement?: number;
}

export type TokenType = "ident" | "number" | "string" | "punct" | "at" | "newline" | "eof";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  terminated?: boolean;
}

export type Bracket = "(" | "[" | "{";

export interface PonpokoUILexResult {
  tokens: Token[];
  errors: PonpokoUIError[];
  open: Bracket[];
  unterminatedString: boolean;
  openQuote: "'" | '"' | null;
}

const PUNCTUATION = [
  "&&",
  "||",
  "==",
  "!=",
  ">=",
  "<=",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ":",
  ".",
  "?",
  "=",
  "+",
  "-",
  "*",
  "/",
  "!",
  ">",
  "<",
] as const;

const CLOSERS: Record<string, Bracket> = { ")": "(", "]": "[", "}": "{" };

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentifierPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function unescape(next: string): string {
  switch (next) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    default:
      return next;
  }
}

export function lexPonpokoUI(source: string): PonpokoUILexResult {
  const tokens: Token[] = [];
  const errors: PonpokoUIError[] = [];
  const open: Bracket[] = [];
  let unterminatedString = false;
  let openQuote: "'" | '"' | null = null;

  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;

    if (ch === "\n") {
      if (open.length === 0) {
        tokens.push({ type: "newline", value: "\n", start: i, end: i + 1 });
      }
      i += 1;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === ";") {
      if (open.length === 0) {
        tokens.push({ type: "newline", value: ";", start: i, end: i + 1 });
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i += 1;
      let value = "";
      let terminated = false;
      while (i < source.length) {
        const current = source[i]!;
        if (current === "\\") {
          const next = source[i + 1];
          if (next === undefined) {
            i += 1;
            break;
          }
          value += unescape(next);
          i += 2;
          continue;
        }
        if (current === quote) {
          terminated = true;
          i += 1;
          break;
        }
        value += current;
        i += 1;
      }
      if (!terminated) {
        unterminatedString = true;
        openQuote = quote;
      }
      tokens.push({ type: "string", value, start, end: i, terminated });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const start = i;
      if (ch === ".") i += 1;
      while (i < source.length && /[0-9]/.test(source[i]!)) i += 1;
      if (source[i] === ".") {
        i += 1;
        while (i < source.length && /[0-9]/.test(source[i]!)) i += 1;
      }
      if (source[i] === "e" || source[i] === "E") {
        const save = i;
        i += 1;
        if (source[i] === "+" || source[i] === "-") i += 1;
        if (/[0-9]/.test(source[i] ?? "")) {
          while (i < source.length && /[0-9]/.test(source[i]!)) i += 1;
        } else {
          i = save;
        }
      }
      tokens.push({ type: "number", value: source.slice(start, i), start, end: i });
      continue;
    }

    if (isIdentifierStart(ch)) {
      const start = i;
      i += 1;
      while (i < source.length && isIdentifierPart(source[i]!)) i += 1;
      tokens.push({ type: "ident", value: source.slice(start, i), start, end: i });
      continue;
    }

    if (ch === "@") {
      tokens.push({ type: "at", value: "@", start: i, end: i + 1 });
      i += 1;
      continue;
    }

    const punct = PUNCTUATION.find((candidate) => source.startsWith(candidate, i));
    if (punct) {
      const start = i;
      i += punct.length;
      const closer = CLOSERS[punct];
      if (closer) {
        if (open[open.length - 1] === closer) {
          open.pop();
        } else {
          errors.push({
            message: `unexpected '${punct}' — there is no matching '${closer}'`,
            index: start,
          });
        }
      } else if (punct === "(" || punct === "[" || punct === "{") {
        open.push(punct);
      }
      tokens.push({ type: "punct", value: punct, start, end: i });
      continue;
    }

    errors.push({ message: `unexpected character '${ch}'`, index: i });
    i += 1;
  }

  tokens.push({ type: "eof", value: "", start: source.length, end: source.length });

  return { tokens, errors, open, unterminatedString, openQuote };
}

export function closingSuffix(lex: PonpokoUILexResult): string {
  let suffix = "";
  if (lex.unterminatedString && lex.openQuote) suffix += lex.openQuote;
  for (let i = lex.open.length - 1; i >= 0; i -= 1) {
    const bracket = lex.open[i]!;
    suffix += bracket === "(" ? ")" : bracket === "[" ? "]" : "}";
  }
  return suffix;
}
