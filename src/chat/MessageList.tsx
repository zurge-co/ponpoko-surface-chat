import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { Host } from "../app/host";
import { ArrowDown } from "lucide-react";
import type { ChatMessageView } from "../contracts/types";
import type { PokoReadiness } from "../lib/poko";
import type { PonpokoUIAction } from "../ponpoko-ui/catalog";
import { Welcome } from "./Welcome";
import { MessageRow } from "./MessageRow";
import { PokoThinking } from "./PokoThinking";
import { parseChatMeta } from "./history";
import type { InFlight } from "./types";

const BOTTOM_SLACK_PX = 48;

function distanceFromBottom(node: HTMLElement): number {
  return node.scrollHeight - node.scrollTop - node.clientHeight;
}

export function MessageList(props: {
  host: Host;
  messages: ChatMessageView[];
  live: [string, InFlight][];
  modelLabel: string;
  endRef: RefObject<HTMLDivElement | null>;
  conversationId?: string | null;
  busy: boolean;
  editingId: number | null;
  readiness: PokoReadiness;
  setup?: ReactNode;
  onRetry: (message: ChatMessageView) => void;
  onRetryLive: (requestId: string) => void;
  onBeginEdit: (message: ChatMessageView) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (message: ChatMessageView, text: string) => void;
  onOpenLink?: (href: string) => void;
  onPonpokoUIAction?: (action: PonpokoUIAction) => void;
  onError: (message: string | null) => void;
}) {
  const { messages, live, conversationId, endRef, busy, modelLabel, readiness, setup, editingId } = props;
  const { onRetry, onRetryLive, onBeginEdit, onCancelEdit, onSubmitEdit, onOpenLink, onPonpokoUIAction } = props;
  const showEmpty = messages.length === 0 && live.length === 0;
  const { host, onError } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const streamingNow = live.some(([, entry]) => !entry.error);
  const waiting = live.some(([, entry]) => !entry.error && !entry.text.trim());
  const failedNow = live.some(([, entry]) => Boolean(entry.error));

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => setAtBottom(distanceFromBottom(node) <= BOTTOM_SLACK_PX);
    onScroll();
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  const jumpToLatest = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    setAtBottom(true);
  }, []);

  const [seenConversation, setSeenConversation] = useState(conversationId);
  if (seenConversation !== conversationId) {
    setSeenConversation(conversationId);
    setAtBottom(true);
  }

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [conversationId]);

  useEffect(() => {
    if (!atBottom) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, live, atBottom]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        role="region"
        aria-label="Conversation transcript"
        aria-busy={busy}
        tabIndex={0}
        className="h-full overflow-y-auto px-3 py-4 sm:px-5 sm:py-5"
      >
        <p role="status" aria-live="polite" className="sr-only">
          {waiting
            ? "Poko is thinking."
            : streamingNow
              ? "Poko is replying."
              : failedNow
                ? "The reply stopped early; what arrived is above."
                : ""}
        </p>
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 sm:gap-6">
          {showEmpty ? (
            <Welcome host={host} readiness={readiness} setup={setup} onError={onError} />
          ) : (
            <>
              {messages.map((message) => (
                <MessageRow
                  key={message.message_id}
                  role={message.role}
                  text={message.content}
                  meta={
                    message.role === "assistant" || message.role === "tool"
                      ? parseChatMeta(message.meta_json)
                      : null
                  }
                  modelLabel={message.role === "assistant" ? modelLabel : undefined}
                  editing={editingId === message.message_id}
                  onRetry={
                    message.role === "assistant" && !busy
                      ? () => onRetry(message)
                      : undefined
                  }
                  onEdit={
                    message.role === "user" && !busy
                      ? () => onBeginEdit(message)
                      : undefined
                  }
                  onCancelEdit={onCancelEdit}
                  onSubmitEdit={(text) => onSubmitEdit(message, text)}
                  onOpenLink={onOpenLink}
                  onPonpokoUIAction={onPonpokoUIAction}
                />
              ))}
              {live.map(([requestId, entry]) =>
                !entry.error && !entry.text.trim() ? (
                  <PokoThinking key={requestId} activities={entry.activities} />
                ) : (
                  <MessageRow
                    key={requestId}
                    role="assistant"
                    text={entry.text}
                    activities={entry.activities}
                    modelLabel={modelLabel}
                    streaming={!entry.error}
                    failed={Boolean(entry.error)}
                    onRetry={entry.error ? () => onRetryLive(requestId) : undefined}
                    onOpenLink={onOpenLink}
                    onPonpokoUIAction={onPonpokoUIAction}
                  />
                ),
              )}
            </>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={jumpToLatest}
          title="Scroll to the newest turn"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-panel px-3 py-1.5 text-xs text-fg shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:border-accent hover:text-accent"
        >
          <ArrowDown size={12} />
          {waiting ? "Jump to Poko" : streamingNow ? "Jump to the reply" : "Jump to latest"}
        </button>
      )}
    </div>
  );
}
