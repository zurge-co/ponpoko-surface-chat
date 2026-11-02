export const PONPOKO_UI_FENCE = "ponpoko-ui";

export type PonpokoUISegment =
  | { kind: "prose"; text: string }
  | { kind: "ponpoko-ui"; info: string; code: string; complete: boolean };

const OPEN_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function isClosingFence(line: string, marker: string, length: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length < length) return false;
  if (trimmed[0] !== marker) return false;
  for (const char of trimmed) {
    if (char !== marker) return false;
  }
  return true;
}

function isPonpokoUIInfo(info: string): boolean {
  const normalized = info.trim().toLowerCase();
  return normalized === PONPOKO_UI_FENCE || normalized.startsWith(`${PONPOKO_UI_FENCE} `);
}

export function splitPonpokoUIFences(markdown: string): PonpokoUISegment[] {
  const lines = markdown.split("\n");
  const segments: PonpokoUISegment[] = [];
  let prose: string[] = [];

  const flushProse = () => {
    if (prose.length === 0) return;
    segments.push({ kind: "prose", text: prose.join("\n") });
    prose = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const open = OPEN_FENCE.exec(line);

    if (!open) {
      prose.push(line);
      i += 1;
      continue;
    }

    const fence = open[1]!;
    const marker = fence[0]!;
    const info = open[2] ?? "";

    if (!isPonpokoUIInfo(info)) {
      prose.push(line);
      i += 1;
      while (i < lines.length) {
        const bodyLine = lines[i]!;
        prose.push(bodyLine);
        i += 1;
        if (isClosingFence(bodyLine, marker, fence.length)) break;
      }
      continue;
    }

    flushProse();
    const codeLines: string[] = [];
    let complete = false;
    i += 1;
    while (i < lines.length) {
      const bodyLine = lines[i]!;
      if (isClosingFence(bodyLine, marker, fence.length)) {
        complete = true;
        i += 1;
        break;
      }
      codeLines.push(bodyLine);
      i += 1;
    }
    segments.push({
      kind: "ponpoko-ui",
      info: info.trim(),
      code: codeLines.join("\n"),
      complete,
    });
  }

  flushProse();
  if (segments.length === 0) segments.push({ kind: "prose", text: markdown });
  return segments;
}
