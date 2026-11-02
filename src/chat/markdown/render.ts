import { HEADING, HR, TABLE_DELIM } from "./types";
import type { Block } from "./types";
import { isFenceStart, isBlockStart, splitTableRow, tableAlign, listMarker, parseList } from "./blocks";

export function renderMarkdown(source: string): Block[] {
  const text = source.replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = isFenceStart(line);
    if (fence) {
      const marker = fence[2]!;
      const lang = (fence[3] ?? "").trim().toLowerCase();
      const body: string[] = [];
      let closed = false;
      i += 1;
      while (i < lines.length) {
        const candidate = lines[i]!;
        const close = candidate.match(/^( {0,3})(`{3,}|~{3,})\s*$/);
        if (close && close[2]![0] === marker[0] && close[2]!.length >= marker.length) {
          closed = true;
          i += 1;
          break;
        }
        body.push(candidate);
        i += 1;
      }
      blocks.push({ type: "code", lang, code: body.join("\n"), closed });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[2]!.length,
        text: heading[3]!.trim(),
      });
      i += 1;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) {
        inner.push(lines[i]!.replace(/^\s{0,3}>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", blocks: renderMarkdown(inner.join("\n")) });
      continue;
    }

    const marker = listMarker(line);
    if (marker) {
      const list = parseList(lines, i, marker.indent, marker.ordered);
      blocks.push(list.block);
      i = list.next;
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      TABLE_DELIM.test(lines[i + 1]!) &&
      splitTableRow(line).length === splitTableRow(lines[i + 1]!).length
    ) {
      const header = splitTableRow(line);
      const align = tableAlign(lines[i + 1]!);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim() && lines[i]!.includes("|")) {
        rows.push(splitTableRow(lines[i]!));
        i += 1;
      }
      blocks.push({ type: "table", header, align, rows });
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i]!.trim() && !isBlockStart(lines[i]!)) {
      paragraph.push(lines[i]!);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}
