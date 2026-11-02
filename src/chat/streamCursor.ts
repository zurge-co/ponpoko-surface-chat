import type { BrokerEvent } from "../contracts/protocol";

export interface CursorState {
  threadId: string;
  seq: number;
  seen: Set<string>;
}

export interface CursorDecision {
  accept: BrokerEvent[];
  duplicate: number;
}

export const SEEN_MEMORY = 512;

export function newCursor(threadId: string, seq = 0): CursorState {
  return { threadId, seq, seen: new Set() };
}

export function cursorKey(event: BrokerEvent): string {
  return `${event.thread_id ?? ""}#${event.event_id}#${event.seq}`;
}

export function remember(cursor: CursorState, event: BrokerEvent): void {
  const key = cursorKey(event);
  cursor.seen.add(key);
  if (cursor.seen.size > SEEN_MEMORY) {
    const oldest = cursor.seen.values().next().value;
    if (typeof oldest === "string") cursor.seen.delete(oldest);
  }
}

export function accept(cursor: CursorState, event: BrokerEvent): CursorDecision {
  const thread = event.thread_id ?? cursor.threadId;
  if (thread !== cursor.threadId) return { accept: [], duplicate: 0 };
  if (cursor.seen.has(cursorKey(event))) return { accept: [], duplicate: 1 };
  remember(cursor, event);
  if (event.seq > cursor.seq) cursor.seq = event.seq;
  return { accept: [event], duplicate: 0 };
}

export function batch(cursor: CursorState, events: readonly BrokerEvent[]): BrokerEvent[] {
  const kept: BrokerEvent[] = [];
  for (const event of events) {
    const decision = accept(cursor, event);
    if (decision.accept.length > 0) kept.push(event);
  }
  return kept;
}

export interface SubscribeAnswer {
  cursor: number;
  subscription_id: string;
}

export function readSubscribeAnswer(value: unknown): SubscribeAnswer | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.cursor !== "number" || !Number.isFinite(row.cursor)) return null;
  return {
    cursor: row.cursor,
    subscription_id: typeof row.subscription_id === "string" ? row.subscription_id : "",
  };
}

export function readExpiredCursor(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const row = error as { code?: unknown; cursor?: unknown };
  if (row.code !== "cursor_expired") return null;
  return typeof row.cursor === "number" && Number.isFinite(row.cursor) ? row.cursor : null;
}

export interface CatchUpPlan {
  reloadSnapshot: boolean;
  cursor: number;
}

export function planCatchUp(_current: number, error: unknown): CatchUpPlan | null {
  const reported = readExpiredCursor(error);
  if (reported === null) return null;
  return { reloadSnapshot: true, cursor: reported };
}
