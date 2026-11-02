import { FENCE, HEADING, HR, LIST_ITEM } from "./types";
import type { Align, ListItem, Block } from "./types";

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value || /[\p{Cc}\s]/u.test(value)) return false;
  return /^(https?:|mailto:)/i.test(value);
}

export function isFenceStart(line: string): RegExpMatchArray | null {
  return line.match(FENCE);
}

export function isBlockStart(line: string): boolean {
  return (
    isFenceStart(line) !== null ||
    HEADING.test(line) ||
    HR.test(line) ||
    LIST_ITEM.test(line) ||
    /^\s{0,3}>/.test(line)
  );
}

export function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]!;
    if (char === "\\" && value[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function tableAlign(line: string): Align[] {
  return splitTableRow(line).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

export function listMarker(line: string): {
  indent: number;
  ordered: boolean;
  number: number;
  text: string;
} | null {
  const match = line.match(LIST_ITEM);
  if (!match) return null;
  const marker = match[2]!;
  const ordered = /\d/.test(marker);
  return {
    indent: match[1]!.replace(/\t/g, "  ").length,
    ordered,
    number: ordered ? Number.parseInt(marker, 10) : 1,
    text: match[3] ?? "",
  };
}

export function parseTask(text: string): { text: string; checked: boolean | null } {
  const match = text.match(/^\[([ xX])\]\s+(.*)$/);
  if (!match) return { text, checked: null };
  return { text: match[2] ?? "", checked: match[1]!.toLowerCase() === "x" };
}

export function parseList(
  lines: string[],
  start: number,
  baseIndent: number,
  ordered: boolean,
): { block: Block; next: number } {
  const items: ListItem[] = [];
  const first = listMarker(lines[start]!);
  const startNumber = first?.number ?? 1;
  let i = start;

  while (i < lines.length) {
    const line = lines[i]!;
    const marker = listMarker(line);

    if (!marker) {
      if (items.length && /^\s+/.test(line) && line.trim()) {
        const last = items[items.length - 1]!;
        last.text += `\n${line.trim()}`;
        i += 1;
        continue;
      }
      break;
    }

    if (marker.indent < baseIndent) break;
    if (marker.indent > baseIndent) {
      if (!items.length) break;
      const nested = parseList(lines, i, marker.indent, marker.ordered);
      items[items.length - 1]!.children.push(nested.block);
      i = nested.next;
      continue;
    }

    if (marker.ordered !== ordered) break;

    const task = parseTask(marker.text);
    const item: ListItem = { text: task.text, checked: task.checked, children: [] };
    items.push(item);
    i += 1;

    while (i < lines.length) {
      const nextLine = lines[i]!;
      if (!nextLine.trim()) {
        let lookahead = i + 1;
        while (lookahead < lines.length && !lines[lookahead]!.trim()) lookahead += 1;
        if (lookahead >= lines.length) {
          i = lookahead;
          break;
        }
        const ahead = listMarker(lines[lookahead]!);
        if (ahead && ahead.indent >= baseIndent) {
          i = lookahead;
          continue;
        }
        break;
      }
      const nextMarker = listMarker(nextLine);
      if (nextMarker) {
        if (nextMarker.indent > baseIndent) {
          const nested = parseList(lines, i, nextMarker.indent, nextMarker.ordered);
          item.children.push(nested.block);
          i = nested.next;
          continue;
        }
        break;
      }
      if (/^\s+/.test(nextLine)) {
        item.text += `\n${nextLine.trim()}`;
        i += 1;
        continue;
      }
      break;
    }
  }

  return {
    block: { type: "list", ordered, start: startNumber, items },
    next: i,
  };
}
