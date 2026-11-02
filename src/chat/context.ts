export const CONTEXT_FENCE = "ponpoko-file";
export const IMAGE_FENCE = "ponpoko-image";
export const PDF_FENCE = "ponpoko-pdf";

export const CONTEXT_FILE_MAX_BYTES = 256 * 1024;
export const CONTEXT_TOTAL_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_FILE_MAX_BYTES = 8 * 1024 * 1024;

export type ContextKind = "text" | "image" | "pdf";

export interface ContextFile {
  name: string;
  path: string;
  bytes: number;
  kind: ContextKind;
  content: string;
  mediaType?: string;
}

export interface AttachPlan {
  files: ContextFile[];
  added: ContextFile[];
  refused: string[];
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

export function estimateTokens(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.ceil(chars / 4);
}

export function contextTotals(files: readonly ContextFile[]): {
  bytes: number;
  chars: number;
  tokens: number;
} {
  let bytes = 0;
  let chars = 0;
  for (const file of files) {
    bytes += file.bytes;
    chars += file.content.length;
  }
  return { bytes, chars, tokens: estimateTokens(chars) };
}

export function capFor(kind: ContextKind): number {
  if (kind === "image") return IMAGE_FILE_MAX_BYTES;
  if (kind === "pdf") return PDF_FILE_MAX_BYTES;
  return CONTEXT_FILE_MAX_BYTES;
}

function capLabel(kind: ContextKind, cap: number): string {
  return kind === "text" ? formatBytes(cap) : formatBytes(cap);
}

export function planContextAttach(
  existing: readonly ContextFile[],
  incoming: readonly ContextFile[],
): AttachPlan {
  const files = [...existing];
  const added: ContextFile[] = [];
  const refused: string[] = [];
  let total = files.reduce((sum, file) => sum + file.bytes, 0);

  for (const file of incoming) {
    if (files.some((attached) => attached.path === file.path)) {
      refused.push(`${file.name} is already attached.`);
      continue;
    }
    const cap = capFor(file.kind);
    if (file.bytes > cap) {
      refused.push(
        `${file.name} is ${formatBytes(file.bytes)} — ${
          file.kind === "image" ? "an image" : file.kind === "pdf" ? "a PDF" : "context"
        } is limited to ${capLabel(file.kind, cap)} per file.`,
      );
      continue;
    }
    if (total + file.bytes > CONTEXT_TOTAL_MAX_BYTES) {
      refused.push(
        `${file.name} would push the context past ${formatBytes(
          CONTEXT_TOTAL_MAX_BYTES,
        )} — remove a file first.`,
      );
      continue;
    }
    files.push(file);
    added.push(file);
    total += file.bytes;
  }

  return { files, added, refused };
}

export function contextFileName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function quoteAttr(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, "%22")}"` : value;
}

export function fenceFor(content: string): string {
  let longest = 2;
  for (const line of content.split("\n")) {
    const match = /^ {0,3}(`{3,})/.exec(line);
    if (match) longest = Math.max(longest, match[1]!.length);
  }
  return "`".repeat(longest + 1);
}

export function serializeContextBlock(file: ContextFile): string {
  const fence = fenceFor(file.content);
  if (file.kind === "image") {
    const media = file.mediaType ?? "image/png";
    return `${fence}${IMAGE_FENCE} path=${quoteAttr(file.path)} bytes=${file.bytes} media=${media}\n${fence}`;
  }
  if (file.kind === "pdf") {
    return `${fence}${PDF_FENCE} path=${quoteAttr(file.path)} bytes=${file.bytes}\n${file.content}\n${fence}`;
  }
  return `${fence}${CONTEXT_FENCE} path=${quoteAttr(file.path)} bytes=${file.bytes}\n${file.content}\n${fence}`;
}

export function contextBlocks(files: readonly ContextFile[]): string {
  return files.map(serializeContextBlock).join("\n\n");
}

export function withContextBlocks(message: string, files: readonly ContextFile[]): string {
  if (files.length === 0) return message;
  const blocks = contextBlocks(files);
  const words = message.replace(/\s+$/, "");
  return words ? `${words}\n\n${blocks}` : blocks;
}

export function fenceKind(info: string): ContextKind | null {
  const name = info.trim().split(/\s/, 1)[0]?.toLowerCase() ?? "";
  if (name === CONTEXT_FENCE) return "text";
  if (name === IMAGE_FENCE) return "image";
  if (name === PDF_FENCE) return "pdf";
  return null;
}

export interface ContextInfo {
  kind: ContextKind;
  path: string;
  bytes: number;
  mediaType?: string;
}

export function parseContextInfo(info: string): ContextInfo | null {
  const kind = fenceKind(info);
  if (!kind) return null;
  const trimmed = info.trim();
  const quoted = /(?:^|\s)path="([^"]*)"/.exec(trimmed);
  const bare = /(?:^|\s)path=(\S+)/.exec(trimmed);
  const raw = quoted ? quoted[1] : bare ? bare[1] : "";
  const path = (raw ?? "").replace(/%22/g, '"').trim();
  if (!path) return null;
  const bytesMatch = /(?:^|\s)bytes=(\d+)/.exec(trimmed);
  const mediaMatch = /(?:^|\s)media=(\S+)/.exec(trimmed);
  const parsed: ContextInfo = {
    kind,
    path,
    bytes: bytesMatch ? Number(bytesMatch[1]) : 0,
  };
  if (kind === "image") parsed.mediaType = mediaMatch ? mediaMatch[1] : "image/png";
  return parsed;
}

export type ContextSegment =
  | { kind: "prose"; text: string }
  | { kind: "file"; file: ContextFile; complete: boolean };

const OPEN_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function isClosingFence(line: string, marker: string, length: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length < length) return false;
  for (const char of trimmed) {
    if (char !== marker) return false;
  }
  return true;
}

export function splitContextFences(text: string): ContextSegment[] {
  const lines = text.split("\n");
  const segments: ContextSegment[] = [];
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
    const parsed = parseContextInfo(info);

    if (!parsed) {
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
    const body: string[] = [];
    let complete = false;
    i += 1;
    while (i < lines.length) {
      const bodyLine = lines[i]!;
      if (isClosingFence(bodyLine, marker, fence.length)) {
        complete = true;
        i += 1;
        break;
      }
      body.push(bodyLine);
      i += 1;
    }
    let content = body.length > 0 ? `${body.join("\n")}\n` : "";
    if (complete && content.endsWith("\n")) content = content.slice(0, -1);
    const file: ContextFile = {
      name: contextFileName(parsed.path),
      path: parsed.path,
      bytes: parsed.kind === "image" ? parsed.bytes : content.length,
      kind: parsed.kind,
      content: parsed.kind === "image" ? "" : content,
    };
    if (parsed.mediaType) file.mediaType = parsed.mediaType;
    segments.push({ kind: "file", file, complete });
  }

  flushProse();
  return segments;
}

export function contextFilesOf(text: string): ContextFile[] {
  return splitContextFences(text)
    .filter((segment): segment is { kind: "file"; file: ContextFile; complete: boolean } =>
      segment.kind === "file",
    )
    .map((segment) => segment.file);
}

export const CONTEXT_ACCEPT: Record<ContextKind, string[]> = {
  text: ["txt", "md", "markdown", "json", "ts", "tsx", "js", "jsx", "rs", "toml", "yaml", "yml", "css", "html", "sh", "py", "go", "log", "csv"],
  image: ["png", "jpg", "jpeg", "gif", "webp"],
  pdf: ["pdf"],
};
