import type { ChatMessageView, ChatTurnRole } from "../contracts/types";


export interface ChatMessageMeta {
  provider_id?: string;
  model?: string;
  elapsed_ms?: number;
  stopped?: boolean;
  tool?: string;
  call_id?: string;
  ok?: boolean;
  summary?: string;
  tool_round?: boolean;
}

export function parseChatMeta(json: string | null | undefined): ChatMessageMeta | null {
  if (!json || !json.trim()) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const meta: ChatMessageMeta = {};
  if (typeof raw.provider_id === "string") meta.provider_id = raw.provider_id;
  if (typeof raw.model === "string") meta.model = raw.model;
  if (typeof raw.elapsed_ms === "number" && Number.isFinite(raw.elapsed_ms)) {
    meta.elapsed_ms = raw.elapsed_ms;
  }
  if (typeof raw.stopped === "boolean") meta.stopped = raw.stopped;
  if (typeof raw.tool === "string" && raw.tool.trim()) meta.tool = raw.tool;
  if (typeof raw.call_id === "string" && raw.call_id.trim()) meta.call_id = raw.call_id;
  if (typeof raw.ok === "boolean") meta.ok = raw.ok;
  if (typeof raw.summary === "string" && raw.summary.trim()) meta.summary = raw.summary;
  if (typeof raw.tool_round === "boolean") meta.tool_round = raw.tool_round;
  return meta;
}

export interface ChatTurn {
  role: ChatTurnRole;
  content: string;
}

export interface RestreamPlan {
  keepSeq: number;
  history: ChatTurn[];
  appendText?: string;
  initialText: string;
}

export function transcriptTurns(rows: ChatMessageView[]): ChatTurn[] {
  return rows
    .filter((row) => {
      if (row.role === "system" || row.role === "tool") return false;
      if (row.role === "assistant" && parseChatMeta(row.meta_json)?.tool_round) return false;
      return true;
    })
    .map((row) => ({ role: row.role as ChatTurnRole, content: row.content }));
}

function lastUserIndex(rows: ChatMessageView[], from: number): number {
  for (let i = from; i >= 0; i -= 1) {
    if (rows[i]?.role === "user") return i;
  }
  return -1;
}

export function planRetry(
  rows: ChatMessageView[],
  assistantMessageId: number,
): RestreamPlan | null {
  const index = rows.findIndex((row) => row.message_id === assistantMessageId);
  if (index < 0 || rows[index]?.role !== "assistant") return null;
  const user = lastUserIndex(rows, index);
  if (user < 0) return null;
  return {
    keepSeq: rows[user]!.seq,
    history: transcriptTurns(rows.slice(0, user + 1)),
    initialText: rows[user]!.content,
  };
}

export function planRetryFromLastUser(rows: ChatMessageView[]): RestreamPlan | null {
  const user = lastUserIndex(rows, rows.length - 1);
  if (user < 0) return null;
  return {
    keepSeq: rows[user]!.seq,
    history: transcriptTurns(rows.slice(0, user + 1)),
    initialText: rows[user]!.content,
  };
}

export function planEdit(rows: ChatMessageView[], userMessageId: number): RestreamPlan | null {
  const index = rows.findIndex((row) => row.message_id === userMessageId);
  if (index < 0 || rows[index]?.role !== "user") return null;
  const user = rows[index]!;
  return {
    keepSeq: user.seq > 0 ? user.seq - 1 : 0,
    history: transcriptTurns(rows.slice(0, index)),
    initialText: user.content,
  };
}

export function transcriptMarkdown(title: string, rows: ChatMessageView[]): string {
  const heading = title.trim() || "Conversation";
  let out = `# ${heading}\n\n`;
  for (const row of rows) {
    if (row.role === "system") continue;
    const who = row.role === "user" ? "You" : "Assistant";
    const body = row.content.replace(/\s+$/, "");
    if (!body) continue;
    out += `## ${who}\n\n${body}\n\n`;
  }
  return out;
}

export function exportFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\p{Cc}+/gu, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.-]+/, "")
    .slice(0, 64)
    .trim()
    .replace(/[.-]+$/, "");
  return `${cleaned || "conversation"}.md`;
}

export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}
