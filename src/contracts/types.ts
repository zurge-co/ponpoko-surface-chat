export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatTurnRole = "system" | "user" | "assistant";

export interface ChatThreadView {
  thread_id: string;
  title: string;
  style_id: string;
  system_prompt: string;
  provider_id: string | null;
  pinned: boolean;
  created_at: number;
  updated_at: number;
}

export interface ChatMessageView {
  message_id: number;
  seq: number;
  role: ChatRole;
  content: string;
  meta_json: string;
  created_at: number;
}

export interface ChatThreadSearchHit {
  thread: ChatThreadView;
  snippet: string;
  match_count: number;
}

export interface ChatThreadSettingsInput {
  title?: string | null;
  styleId: string;
  systemPrompt: string;
  providerId: string | null;
  pinned: boolean;
}

export const CONTEXT_KINDS = ["text", "image", "pdf"] as const;

export type ContextKind = (typeof CONTEXT_KINDS)[number];

export interface ContextFileView {
  name: string;
  path: string;
  bytes: number;
  kind: ContextKind;
  media_type: string | null;
  content: string;
}

export interface ChatStreamTurn {
  role: ChatTurnRole;
  content: string;
}

export interface ChatProviderView {
  provider_id: string;
  kind: string;
  model: string;
  base_url: string | null;
  has_key: boolean;
  label: string | null;
}

export interface ChatDeltaEvent {
  request_id: string;
  thread_id: string;
  seq: number;
  text: string;
}

export interface ChatDoneEvent {
  request_id: string;
  thread_id: string;
  text: string;
}

export interface ChatFailedEvent {
  request_id: string;
  thread_id: string;
  message: string;
}

export interface ChatCancelledEvent {
  request_id: string;
  thread_id: string;
  text: string;
}

export interface ChatToolEvent {
  request_id: string;
  thread_id: string;
  tool: string;
  call_id: string;
  ok: boolean;
  summary: string;
}

export interface PreferenceRow {
  key: string;
  value: string;
}

export const PROTOCOL_INFO = "protocol.info";

export interface ProtocolInfoView {
  protocol: number;
  host_version: string;
  identity: string;
}

export interface StreamSubscriptionView {
  subscription_id: string;
  thread_id: string;
  cursor: number;
}

export interface StreamCatchUpView {
  subscription_id: string;
  thread_id: string;
  cursor: number;
  deltas: { request_id: string; text: string }[];
}

export function readThread(value: unknown): ChatThreadView {
  const row = asRecord(value);
  return {
    thread_id: str(row.thread_id),
    title: str(row.title),
    style_id: str(row.style_id),
    system_prompt: str(row.system_prompt),
    provider_id: nullableStr(row.provider_id),
    pinned: row.pinned === true,
    created_at: num(row.created_at),
    updated_at: num(row.updated_at),
  };
}

export function readThreads(value: unknown): ChatThreadView[] {
  return asArray(value).map(readThread);
}

export function readMessage(value: unknown): ChatMessageView {
  const row = asRecord(value);
  const role = row.role;
  return {
    message_id: num(row.message_id),
    seq: num(row.seq),
    role:
      role === "user" || role === "assistant" || role === "tool" || role === "system"
        ? role
        : "assistant",
    content: str(row.content),
    meta_json: str(row.meta_json),
    created_at: num(row.created_at),
  };
}

export function readMessages(value: unknown): ChatMessageView[] {
  return asArray(value).map(readMessage);
}

export function readSearchHits(value: unknown): ChatThreadSearchHit[] {
  return asArray(value).map((entry) => {
    const row = asRecord(entry);
    return {
      thread: readThread(row.thread),
      snippet: str(row.snippet),
      match_count: num(row.match_count),
    };
  });
}

export function readContextFile(value: unknown): ContextFileView {
  const row = asRecord(value);
  const kind = CONTEXT_KINDS.find((candidate) => candidate === row.kind) ?? "text";
  return {
    name: str(row.name),
    path: str(row.path),
    bytes: num(row.bytes),
    kind,
    media_type: nullableStr(row.media_type),
    content: str(row.content),
  };
}

export function readProviders(value: unknown): ChatProviderView[] {
  return asArray(value).map((entry) => {
    const row = asRecord(entry);
    return {
      provider_id: str(row.provider_id),
      kind: str(row.kind),
      model: str(row.model),
      base_url: nullableStr(row.base_url),
      has_key: row.has_key === true,
      label: nullableStr(row.label),
    };
  });
}

export function readPreferences(value: unknown): PreferenceRow[] {
  return asArray(value).map((entry) => {
    const row = asRecord(entry);
    return { key: str(row.key), value: str(row.value) };
  });
}

export function readProtocolInfo(value: unknown): ProtocolInfoView {
  const row = asRecord(value);
  return {
    protocol: num(row.protocol),
    host_version: str(row.host_version),
    identity: str(row.identity),
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
