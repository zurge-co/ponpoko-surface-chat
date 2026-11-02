export const BROKER_CHANNEL = "ponpoko.surface.v2";

export const LEGACY_CHANNEL = "ponpoko.surface.v1";

export const READY_CONTROL = "ponpoko.surface.ready";

export const HELLO_CONTROL = "ponpoko.host.hello";

export const PALETTE_CONTROL = "ponpoko.host.palette";

export const DROP_CONTROL = "ponpoko.host.drop";

export const PROTOCOL_VERSION = 2;

export const HOST_CHAT = "host.chat";

export const HOST_WORK = "host.work";

export const NAMESPACES = [HOST_CHAT, HOST_WORK] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const CHAT_OPERATIONS = [
  "protocol.info",
  "threads.list",
  "threads.create",
  "threads.update",
  "threads.rename",
  "threads.pin",
  "threads.delete",
  "threads.search",
  "threads.export",
  "messages.list",
  "messages.append",
  "messages.truncate",
  "message.send",
  "stream.subscribe",
  "stream.unsubscribe",
  "turn.cancel",
  "providers.list",
  "attachments.pick",
  "attachments.read",
  "attachments.paste-image",
  "preferences.list",
  "preferences.set",
  "settings.open",
  "link.open",
] as const;

export type ChatOperation = (typeof CHAT_OPERATIONS)[number];

export const WORK_OPERATIONS = [
  "list",
  "get",
  "events.subscribe",
  "events.unsubscribe",
  "instruction.append",
  "pause",
  "resume",
  "stop",
] as const;

export type WorkOperation = (typeof WORK_OPERATIONS)[number];

export const OPERATIONS: Record<Namespace, readonly string[]> = {
  [HOST_CHAT]: CHAT_OPERATIONS,
  [HOST_WORK]: WORK_OPERATIONS,
};

export function isNamespace(value: unknown): value is Namespace {
  return typeof value === "string" && (NAMESPACES as readonly string[]).includes(value);
}

export function isOperation(namespace: Namespace, operation: unknown): boolean {
  return typeof operation === "string" && OPERATIONS[namespace].includes(operation);
}

export function operationName(namespace: Namespace, operation: string): string {
  return `${namespace}.${operation}`;
}

export const CHAT_EVENT_TYPES = [
  "delta",
  "tool",
  "done",
  "failed",
  "cancelled",
  "providers-changed",
  "threads-changed",
] as const;

export type ChatEventType = (typeof CHAT_EVENT_TYPES)[number];

export const WORK_EVENT_TYPES = [
  "snapshot_changed",
  "phase_changed",
  "progress_message",
  "tool_started",
  "tool_finished",
  "budget_paused",
  "input_required",
  "model_finished",
  "evidence_recorded",
  "artifact_changed",
  "completed",
  "failed",
] as const;

export type WorkEventType = (typeof WORK_EVENT_TYPES)[number];

export const EVENT_TYPES = [...CHAT_EVENT_TYPES, ...WORK_EVENT_TYPES] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface BrokerRequest {
  channel: typeof BROKER_CHANNEL;
  view: string;
  request_id: string;
  namespace: Namespace;
  operation: string;
  payload?: unknown;
}

export interface BrokerErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}

export interface BrokerResponse {
  channel: typeof BROKER_CHANNEL;
  view: string;
  request_id: string;
  ok: boolean;
  result?: unknown;
  error?: BrokerErrorBody;
}

export interface BrokerEvent {
  channel: typeof BROKER_CHANNEL;
  view: string;
  event_id: string;
  seq: number;
  type: string;
  timestamp: number;
  work_id?: string;
  thread_id?: string;
  payload?: unknown;
}

export interface BrokerControl {
  channel: typeof BROKER_CHANNEL;
  view: string;
  control: string;
  doors?: readonly string[];
  protocol?: number;
  tokens?: Record<string, string>;
  paths?: readonly string[];
}

export function isBrokerChannel(value: unknown): boolean {
  return value === BROKER_CHANNEL || value === LEGACY_CHANNEL;
}

export function isBrokerResponse(value: unknown): value is BrokerResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BrokerResponse>;
  return candidate.channel === BROKER_CHANNEL && typeof candidate.request_id === "string";
}

export function isBrokerEvent(value: unknown): value is BrokerEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BrokerEvent>;
  return (
    candidate.channel === BROKER_CHANNEL &&
    typeof candidate.event_id === "string" &&
    typeof candidate.seq === "number" &&
    typeof candidate.type === "string"
  );
}

export function requestFor(
  view: string,
  requestId: string,
  namespace: Namespace,
  operation: string,
  payload: unknown,
): BrokerRequest {
  return payload === undefined
    ? { channel: BROKER_CHANNEL, view, request_id: requestId, namespace, operation }
    : { channel: BROKER_CHANNEL, view, request_id: requestId, namespace, operation, payload };
}
