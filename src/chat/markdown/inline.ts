import type { InlineNode } from "./types";
import { isSafeHref } from "./blocks";

export function findClosing(
  text: string,
  marker: string,
  from: number,
): number {
  let index = from;
  while (index < text.length) {
    const found = text.indexOf(marker, index);
    if (found < 0) return -1;
    let backslashes = 0;
    for (let j = found - 1; j >= 0 && text[j] === "\\"; j -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return found;
    index = found + marker.length;
  }
  return -1;
}

export function isWordChar(char: string | undefined): boolean {
  return !!char && /[A-Za-z0-9_]/.test(char);
}

export function parseLinkAt(
  text: string,
  start: number,
  image: boolean,
): { node: InlineNode; next: number } | null {
  const open = start + (image ? 2 : 1);
  let depth = 1;
  let close = open;
  while (close < text.length) {
    const char = text[close]!;
    if (char === "\\") {
      close += 2;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) break;
    }
    close += 1;
  }
  if (close >= text.length || text[close] !== "]") return null;
  if (text[close + 1] !== "(") return null;

  const label = text.slice(open, close);
  let parens = 1;
  let end = close + 2;
  while (end < text.length) {
    const char = text[end]!;
    if (char === "\\") {
      end += 2;
      continue;
    }
    if (char === "(") parens += 1;
    if (char === ")") {
      parens -= 1;
      if (parens === 0) break;
    }
    end += 1;
  }
  if (end >= text.length || text[end] !== ")") return null;

  const target = text.slice(close + 2, end).trim();
  const hrefMatch = target.match(/^(\S+)(?:\s+["'(].*)?$/);
  const href = hrefMatch?.[1] ?? target;
  const children = parseInline(label);
  if (!isSafeHref(href)) {
    return { node: { type: "text", text: image ? `Image: ${label}` : label }, next: end + 1 };
  }
  return {
    node: { type: "link", href, children, ...(image ? { image: true } : {}) },
    next: end + 1,
  };
}

export function parseInline(source: string, depth = 0): InlineNode[] {
  if (depth > 8) return [{ type: "text", text: source }];
  const text = source;
  const nodes: InlineNode[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    const char = text[i]!;

    if (char === "\\" && i + 1 < text.length && /[\\`*_{}[\]()#+\-.!~>|]/.test(text[i + 1]!)) {
      buffer += text[i + 1]!;
      i += 2;
      continue;
    }

    if (char === "`") {
      let run = 1;
      while (text[i + run] === "`") run += 1;
      const marker = "`".repeat(run);
      const close = findClosing(text, marker, i + run);
      if (close > i + run) {
        flush();
        nodes.push({ type: "code", text: text.slice(i + run, close) });
        i = close + run;
        continue;
      }
      buffer += marker;
      i += run;
      continue;
    }

    if (char === "!" && text[i + 1] === "[") {
      const link = parseLinkAt(text, i, true);
      if (link) {
        flush();
        nodes.push(link.node);
        i = link.next;
        continue;
      }
    }
    if (char === "[") {
      const link = parseLinkAt(text, i, false);
      if (link) {
        flush();
        nodes.push(link.node);
        i = link.next;
        continue;
      }
    }

    if (char === "<") {
      const close = text.indexOf(">", i + 1);
      const candidate = close > i ? text.slice(i + 1, close) : "";
      if (close > i && isSafeHref(candidate) && !/\s/.test(candidate)) {
        flush();
        nodes.push({
          type: "link",
          href: candidate,
          children: [{ type: "text", text: candidate }],
        });
        i = close + 1;
        continue;
      }
    }

    if ((char === "*" && text[i + 1] === "*") || (char === "_" && text[i + 1] === "_")) {
      const marker = char + char;
      if (char === "_" && (isWordChar(text[i - 1]) || isWordChar(text[i + 2]))) {
        buffer += marker;
        i += 2;
        continue;
      }
      const close = findClosing(text, marker, i + 2);
      if (close > i + 2) {
        flush();
        nodes.push({
          type: "strong",
          children: parseInline(text.slice(i + 2, close), depth + 1),
        });
        i = close + 2;
        continue;
      }
      buffer += marker;
      i += 2;
      continue;
    }

    if ((char === "~" && text[i + 1] === "~")) {
      const close = findClosing(text, "~~", i + 2);
      if (close > i + 2) {
        flush();
        nodes.push({
          type: "del",
          children: parseInline(text.slice(i + 2, close), depth + 1),
        });
        i = close + 2;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      if (char === "_" && (isWordChar(text[i - 1]) || isWordChar(text[i + 1]))) {
        buffer += char;
        i += 1;
        continue;
      }
      const close = findClosing(text, char, i + 1);
      if (close > i + 1) {
        flush();
        nodes.push({
          type: "em",
          children: parseInline(text.slice(i + 1, close), depth + 1),
        });
        i = close + 1;
        continue;
      }
    }

    buffer += char;
    i += 1;
  }

  flush();
  return nodes;
}
