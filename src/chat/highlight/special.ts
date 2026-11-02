import type { Token } from "./types";
import { LANGS } from "./langs";
import { consumeString } from "./helpers";
import { scanGeneric } from "./generic";

export function scanYaml(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) tokens.push({ kind: "plain", text: "\n" });
    const commentAt = line.search(/(^|\s)#/);
    const body = commentAt >= 0 ? line.slice(0, commentAt) : line;
    const comment = commentAt >= 0 ? line.slice(commentAt) : "";
    const key = body.match(/^(\s*)([^:#]+?):(\s*)(.*)$/);
    if (key) {
      if (key[1]) tokens.push({ kind: "plain", text: key[1] });
      tokens.push({ kind: "type", text: key[2]! });
      tokens.push({ kind: "punctuation", text: ":" });
      if (key[3]) tokens.push({ kind: "plain", text: key[3] });
      if (key[4]) tokens.push(...scanGeneric(key[4], LANGS.yaml!));
    } else if (body.trim().startsWith("-")) {
      const dash = body.indexOf("-");
      if (dash > 0) tokens.push({ kind: "plain", text: body.slice(0, dash) });
      tokens.push({ kind: "punctuation", text: "-" });
      tokens.push(...scanGeneric(body.slice(dash + 1), LANGS.yaml!));
    } else {
      tokens.push(...scanGeneric(body, LANGS.yaml!));
    }
    if (comment) tokens.push({ kind: "comment", text: comment });
  });
  return tokens;
}

export function scanDiff(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) tokens.push({ kind: "plain", text: "\n" });
    if (line.startsWith("+++") || line.startsWith("---")) {
      tokens.push({ kind: "meta", text: line });
    } else if (line.startsWith("@@")) {
      tokens.push({ kind: "meta", text: line });
    } else if (line.startsWith("+")) {
      tokens.push({ kind: "insert", text: line });
    } else if (line.startsWith("-")) {
      tokens.push({ kind: "delete", text: line });
    } else if (line.startsWith("diff ") || line.startsWith("index ")) {
      tokens.push({ kind: "meta", text: line });
    } else {
      tokens.push({ kind: "plain", text: line });
    }
  });
  return tokens;
}

export function scanHtml(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    if (code.startsWith("<!--", i)) {
      const end = code.indexOf("-->", i + 4);
      const stop = end < 0 ? code.length : end + 3;
      tokens.push({ kind: "comment", text: code.slice(i, stop) });
      i = stop;
      continue;
    }
    if (code[i] === "<") {
      const end = code.indexOf(">", i + 1);
      const stop = end < 0 ? code.length : end + 1;
      const tag = code.slice(i, stop);
      const inner = tag.slice(1, tag.endsWith(">") ? -1 : undefined);
      tokens.push({ kind: "punctuation", text: "<" });
      const nameMatch = inner.match(/^(\/?)([A-Za-z][\w:-]*)/);
      if (nameMatch) {
        if (nameMatch[1]) tokens.push({ kind: "punctuation", text: nameMatch[1] });
        tokens.push({ kind: "keyword", text: nameMatch[2]! });
        let rest = inner.slice(nameMatch[0].length);
        while (rest.length) {
          const ws = rest.match(/^\s+/);
          if (ws) {
            tokens.push({ kind: "plain", text: ws[0] });
            rest = rest.slice(ws[0].length);
            continue;
          }
          const attr = rest.match(/^([A-Za-z_:][\w:.-]*)/);
          if (attr) {
            tokens.push({ kind: "type", text: attr[1]! });
            rest = rest.slice(attr[0].length);
            continue;
          }
          if (rest[0] === "=") {
            tokens.push({ kind: "operator", text: "=" });
            rest = rest.slice(1);
            continue;
          }
          const quote = rest[0];
          if (quote === '"' || quote === "'") {
            const endQuote = consumeString(rest, 0, quote);
            tokens.push({ kind: "string", text: rest.slice(0, endQuote) });
            rest = rest.slice(endQuote);
            continue;
          }
          tokens.push({ kind: "punctuation", text: rest[0]! });
          rest = rest.slice(1);
        }
      } else {
        tokens.push({ kind: "plain", text: inner });
      }
      if (tag.endsWith(">")) tokens.push({ kind: "punctuation", text: ">" });
      i = stop;
      continue;
    }
    const next = code.indexOf("<", i);
    const stop = next < 0 ? code.length : next;
    tokens.push({ kind: "plain", text: code.slice(i, stop) });
    i = stop;
  }
  return tokens;
}
