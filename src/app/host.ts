import type { Broker, HelloView } from "../bridge/broker";
import { HOST_CHAT, PROTOCOL_VERSION, type BrokerEvent } from "../contracts/protocol";
import {
  readContextFile,
  readMessages,
  readPreferences,
  readProtocolInfo,
  readProviders,
  readSearchHits,
  readThread,
  readThreads,
  type ChatMessageView,
  type ChatProviderView,
  type ChatStreamTurn,
  type ChatThreadSearchHit,
  type ChatThreadSettingsInput,
  type ChatThreadView,
  type ContextFileView,
  type PreferenceRow,
  type ProtocolInfoView,
} from "../contracts/types";
import { HostError } from "../contracts/errors";

export interface Host {
  broker: Broker;
  protocol: ProtocolInfoView | null;
}

export function hostChat<T>(host: Host, operation: string, payload?: unknown): Promise<T> {
  return host.broker.call<T>(HOST_CHAT, operation, payload);
}

export async function readProtocol(host: Host): Promise<ProtocolInfoView> {
  const info = readProtocolInfo(await hostChat<unknown>(host, "protocol.info"));
  if (info.protocol !== PROTOCOL_VERSION) {
    throw new HostError(
      "protocol_mismatch",
      `this Chat speaks protocol ${PROTOCOL_VERSION} and the host answered ${info.protocol || "nothing"}`,
      false,
    );
  }
  return info;
}

export async function listThreads(host: Host): Promise<ChatThreadView[]> {
  return readThreads(await hostChat<unknown>(host, "threads.list"));
}

export async function createThread(host: Host, title: string): Promise<ChatThreadView> {
  return readThread(await hostChat<unknown>(host, "threads.create", { title }));
}

export async function renameThread(host: Host, threadId: string, title: string): Promise<ChatThreadView> {
  const answered = await hostChat<unknown>(host, "threads.rename", { thread_id: threadId, title });
  return typeof answered === "object" && answered !== null
    ? readThread(answered)
    : {
        thread_id: threadId,
        title,
        style_id: "",
        system_prompt: "",
        provider_id: null,
        pinned: false,
        created_at: 0,
        updated_at: 0,
      };
}

export async function pinThread(host: Host, threadId: string, pinned: boolean): Promise<ChatThreadView> {
  return readThread(await hostChat<unknown>(host, "threads.pin", { thread_id: threadId, pinned }));
}

export async function deleteThread(host: Host, threadId: string): Promise<boolean> {
  return (await hostChat<unknown>(host, "threads.delete", { thread_id: threadId })) === true;
}

export async function searchThreads(host: Host, query: string): Promise<ChatThreadSearchHit[]> {
  return readSearchHits(await hostChat<unknown>(host, "threads.search", { query }));
}

export async function updateThread(
  host: Host,
  threadId: string,
  settings: ChatThreadSettingsInput,
): Promise<ChatThreadView> {
  return readThread(
    await hostChat<unknown>(host, "threads.update", {
      thread_id: threadId,
      title: settings.title ?? null,
      style_id: settings.styleId,
      system_prompt: settings.systemPrompt,
      provider_id: settings.providerId,
      pinned: settings.pinned,
    }),
  );
}

export async function exportThread(host: Host, threadId: string): Promise<string | null> {
  const answered = await hostChat<unknown>(host, "threads.export", { thread_id: threadId });
  const row = typeof answered === "object" && answered !== null ? (answered as Record<string, unknown>) : {};
  if (row.cancelled === true) return null;
  return typeof row.path === "string" ? row.path : null;
}

export async function listMessages(host: Host, threadId: string): Promise<ChatMessageView[]> {
  return readMessages(await hostChat<unknown>(host, "messages.list", { thread_id: threadId }));
}

export async function appendMessage(
  host: Host,
  threadId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ChatMessageView> {
  const answered = await hostChat<unknown>(host, "messages.append", { thread_id: threadId, role, content });
  const [message] = readMessages([answered]);
  if (!message) throw new HostError("host_unavailable", "the host stored no message", true);
  return message;
}

export async function truncateMessages(host: Host, threadId: string, keepSeq: number): Promise<number> {
  const answered = await hostChat<unknown>(host, "messages.truncate", { thread_id: threadId, keep_seq: keepSeq });
  return typeof answered === "number" ? answered : 0;
}

export async function sendTurn(
  host: Host,
  args: {
    requestId: string;
    threadId: string;
    providerId: string;
    messages: ChatStreamTurn[];
  },
): Promise<void> {
  await hostChat(host, "message.send", {
    request_id: args.requestId,
    thread_id: args.threadId,
    provider_id: args.providerId,
    messages: args.messages,
  });
}

export async function cancelTurn(host: Host, requestId: string): Promise<boolean> {
  return (await hostChat<unknown>(host, "turn.cancel", { request_id: requestId })) === true;
}

export interface StreamSubscription {
  cursor: number;
  subscription_id: string;
}

export async function subscribeStream(
  host: Host,
  threadId: string,
  after = 0,
): Promise<StreamSubscription> {
  const answered = await hostChat<unknown>(host, "stream.subscribe", { thread_id: threadId, after });
  const row = typeof answered === "object" && answered !== null ? (answered as Record<string, unknown>) : {};
  return {
    cursor: typeof row.cursor === "number" ? row.cursor : after,
    subscription_id: typeof row.subscription_id === "string" ? row.subscription_id : "",
  };
}

export async function unsubscribeStream(host: Host, threadId: string): Promise<void> {
  await hostChat(host, "stream.unsubscribe", { thread_id: threadId });
}

export async function listProviders(host: Host): Promise<ChatProviderView[]> {
  return readProviders(await hostChat<unknown>(host, "providers.list"));
}

export async function pickAttachments(host: Host): Promise<ContextFileView[]> {
  const answered = await hostChat<unknown>(host, "attachments.pick");
  return Array.isArray(answered) ? answered.map(readContextFile) : [];
}

export async function readAttachments(host: Host, paths: readonly string[]): Promise<ContextFileView[]> {
  const answered = await hostChat<unknown>(host, "attachments.read", { paths: [...paths] });
  return Array.isArray(answered) ? answered.map(readContextFile) : [];
}

export async function pasteImage(host: Host): Promise<ContextFileView> {
  return readContextFile(await hostChat<unknown>(host, "attachments.paste-image"));
}

export async function listPreferences(host: Host): Promise<PreferenceRow[]> {
  return readPreferences(await hostChat<unknown>(host, "preferences.list"));
}

export async function setPreference(host: Host, key: string, value: string): Promise<void> {
  await hostChat(host, "preferences.set", { key, value });
}

export async function openSettings(host: Host, destination: string): Promise<void> {
  await hostChat(host, "settings.open", { destination });
}

export async function openLink(host: Host, href: string): Promise<void> {
  await hostChat(host, "link.open", { href });
}

export function eventScope(event: BrokerEvent): string {
  return event.work_id ?? event.thread_id ?? "";
}

export function helloProtocol(hello: HelloView | null): number {
  return hello?.protocol ?? 0;
}
