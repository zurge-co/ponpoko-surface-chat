import type { Host } from "./host";
import { HOST_SURFACE, BROKER_CHANNEL, type BrokerEvent } from "../contracts/protocol";

type Poll = { live: boolean; cursor: number; release?: () => void; timer?: ReturnType<typeof setTimeout> };
const polls = new WeakMap<Host, Map<string, Poll>>();

export async function subscribeBackend(host: Host, threadId: string, after: number) {
  let active = polls.get(host);
  if (!active) { active = new Map(); polls.set(host, active); }
  const previous = active.get(threadId);
  if (previous) { previous.live = false; clearTimeout(previous.timer); previous.release?.(); }
  const poll: Poll = { live: true, cursor: after };
  active.set(threadId, poll);
  poll.release = host.broker.onStop(() => { poll.live = false; clearTimeout(poll.timer); });
  if (after === 0) {
    const snapshot = await host.broker.call<{ cursor: number; active: { request_id: string; partial: string; error: string | null } | null }>(HOST_SURFACE, "backend.call", { method: "stream.snapshot", params: { thread_id: threadId } });
    if (!poll.live) return { cursor: after, subscription_id: threadId };
    poll.cursor = snapshot.cursor;
    if (snapshot.active) host.broker.emitBackendEvent({ channel: BROKER_CHANNEL, view: host.broker.view,
      event_id: `restored-${threadId}`, seq: snapshot.cursor, thread_id: threadId, type: "restored", timestamp: Date.now(),
      payload: { ...snapshot.active, thread_id: threadId, text: snapshot.active.partial } });
  }
  async function next(): Promise<void> {
    if (!poll.live) return;
    try {
      const events = await host.broker.call<BrokerEvent[]>(HOST_SURFACE, "backend.call", {
        method: "stream.events", params: { thread_id: threadId, after: poll.cursor },
      });
      if (!poll.live) return;
      for (const event of events) {
        host.broker.emitBackendEvent({ ...event, channel: BROKER_CHANNEL, view: host.broker.view });
        poll.cursor = event.seq;
      }
    } catch (error) {
      if (!poll.live) return;
      host.broker.emitBackendEvent({ channel: BROKER_CHANNEL, view: host.broker.view,
        event_id: `backend-error-${Date.now()}`, seq: poll.cursor + 1, thread_id: threadId,
        type: "backend-unavailable", timestamp: Date.now(), payload: { thread_id: threadId, message: String(error) } });
      poll.live = false;
      throw error;
    }
    if (poll.live) poll.timer = setTimeout(() => { void next().catch(() => {}); }, 150);
  }
  await next();
  return { cursor: poll.cursor, subscription_id: threadId };
}
export function unsubscribeBackend(host: Host, threadId: string) {
  const poll = polls.get(host)?.get(threadId);
  if (poll) { poll.live = false; clearTimeout(poll.timer); poll.release?.(); polls.get(host)?.delete(threadId); }
}
