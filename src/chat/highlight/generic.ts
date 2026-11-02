import type { Token, LangSpec } from "./types";
import { isIdentStart, isIdentPart, consumeString, classifyWord } from "./helpers";

export function scanGeneric(code: string, spec: LangSpec): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    const char = code[i]!;

    if (char === "\n" || char === "\r" || char === " " || char === "\t") {
      tokens.push({ kind: "plain", text: char });
      i += 1;
      continue;
    }

    const lineComment = spec.lineComment?.find((marker) => {
      if (!code.startsWith(marker, i)) return false;
      if (spec.hashCommentNeedsSpace && marker === "#") {
        const before = code[i - 1];
        return before === undefined || /\s/.test(before);
      }
      return true;
    });
    if (lineComment) {
      const end = code.indexOf("\n", i);
      const stop = end < 0 ? code.length : end;
      tokens.push({ kind: "comment", text: code.slice(i, stop) });
      i = stop;
      continue;
    }

    if (spec.blockComment && code.startsWith(spec.blockComment[0], i)) {
      const end = code.indexOf(spec.blockComment[1], i + spec.blockComment[0].length);
      const stop = end < 0 ? code.length : end + spec.blockComment[1].length;
      tokens.push({ kind: "comment", text: code.slice(i, stop) });
      i = stop;
      continue;
    }

    if (spec.shellVars && char === "$") {
      let end = i + 1;
      if (code[end] === "{") {
        const brace = code.indexOf("}", end);
        end = brace < 0 ? code.length : brace + 1;
      } else {
        while (end < code.length && /[A-Za-z0-9_@#?$!*-]/.test(code[end]!)) end += 1;
      }
      tokens.push({ kind: "type", text: code.slice(i, end) });
      i = end;
      continue;
    }

    if (spec.quotes?.includes(char)) {
      if (spec.tripleQuotes && code.startsWith(char.repeat(3), i)) {
        const end = consumeString(code, i, char.repeat(3));
        tokens.push({ kind: "string", text: code.slice(i, end) });
        i = end;
        continue;
      }
      if (spec.rawBacktick && char === "`") {
        const end = consumeString(code, i, "`");
        tokens.push({ kind: "string", text: code.slice(i, end) });
        i = end;
        continue;
      }
      const end = consumeString(code, i, char);
      tokens.push({ kind: "string", text: code.slice(i, end) });
      i = end;
      continue;
    }

    const number = code.slice(i).match(/^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)/);
    if (number) {
      tokens.push({ kind: "number", text: number[0] });
      i += number[0].length;
      continue;
    }

    if (isIdentStart(char)) {
      let end = i + 1;
      while (end < code.length && isIdentPart(code[end]!)) end += 1;
      const word = code.slice(i, end);
      let look = end;
      while (look < code.length && /[ \t]/.test(code[look]!)) look += 1;
      tokens.push({ kind: classifyWord(word, code[look] ?? "", spec), text: word });
      i = end;
      continue;
    }

    if (/[=+\-*/%<>!&|^~?:]/.test(char)) {
      let end = i + 1;
      while (end < code.length && /[=+\-*/%<>!&|^~?:]/.test(code[end]!)) end += 1;
      tokens.push({ kind: "operator", text: code.slice(i, end) });
      i = end;
      continue;
    }

    if (/[()[\]{},.;]/.test(char)) {
      tokens.push({ kind: "punctuation", text: char });
      i += 1;
      continue;
    }

    tokens.push({ kind: "plain", text: char });
    i += 1;
  }

  return tokens;
}
