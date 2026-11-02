import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  appendMessage,
  cancelTurn,
  createThread,
  listMessages,
  sendTurn,
  truncateMessages,
  type Host,
} from "../app/host";
import { asRecord, type ChatMessageView, type ChatStreamTurn, type ChatThreadView } from "../contracts/types";
import type { BrokerEvent } from "../contracts/protocol";
import { createDeltaBatcher } from "./streamBuffer";
import { accept, newCursor, type CursorState } from "./streamCursor";
import { titleFrom } from "./titles";
import {
  planEdit,
  planRetry,
  planRetryFromLastUser,
  transcriptTurns,
  type RestreamPlan,
} from "./history";
import { withContextBlocks, type ContextFile } from "./context";
import type { InFlight } from "./types";

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

interface ChatStreamInput {
  host: Host;
  activeId: string | null;
  messages: ChatMessageView[];
  threads: ChatThreadView[] | null;
  draft: string;
  contextFiles: ContextFile[];
  providerId: string;
  overlaysOpen: boolean;
  setError: (message: string | null) => void;
  notify: (message: string) => void;
  setActiveId: (threadId: string | null) => void;
  setMessages: Dispatch<SetStateAction<ChatMessageView[]>>;
  setThreads: Dispatch<SetStateAction<ChatThreadView[] | null>>;
  setDraft: (draft: string | ((current: string) => string)) => void;
  setContextFiles: Dispatch<SetStateAction<ContextFile[]>>;
  reloadThreads: () => Promise<void>;
}

export function useChatStream(input: ChatStreamInput) {
  const {
    host,
    activeId,
    messages,
    threads,
    draft,
    contextFiles,
    providerId,
    overlaysOpen,
    setError,
    notify,
    setActiveId,
    setMessages,
    setThreads,
    setDraft,
    setContextFiles,
    reloadThreads,
  } = input;

  const [inFlight, setInFlight] = useState<Record<string, InFlight>>({});
  const [sending, setSending] = useState(false);

  const activeIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Record<string, InFlight>>({});
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    inFlightRef.current = inFlight;
  }, [inFlight]);

  const applyDeltas = useCallback((batch: Map<string, string>) => {
    setInFlight((prev) => {
      let next: Record<string, InFlight> | null = null;
      for (const [requestId, text] of batch) {
        const current = prev[requestId];
        if (!current) continue;
        if (!next) next = { ...prev };
        next[requestId] = { ...current, text: current.text + text };
      }
      return next ?? prev;
    });
  }, []);
  const deltas = useMemo(() => createDeltaBatcher({ onFlush: applyDeltas }), [applyDeltas]);
  useEffect(() => () => deltas.flush(), [deltas]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      try {
        setMessages(await listMessages(host, threadId));
      } catch (e) {
        setError(String(e));
      }
    },
    [host, setError, setMessages],
  );

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let live = true;
    listMessages(host, activeId)
      .then((rows) => live && setMessages(rows))
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [activeId, host, setError, setMessages]);

  const cursors = useRef<Record<string, CursorState>>({});
  const cursorFor = useCallback((threadId: string): CursorState => {
    const found = cursors.current[threadId];
    if (found) return found;
    const created = newCursor(threadId);
    cursors.current[threadId] = created;
    return created;
  }, []);

  useEffect(() => {
    return host.broker.onEvent((event: BrokerEvent) => {
      const payload = asRecord(event.payload);
      const requestId = typeof payload.request_id === "string" ? payload.request_id : "";
      const threadId =
        typeof payload.thread_id === "string" ? payload.thread_id : (event.thread_id ?? "");
      if (event.type === "restored") {
        setInFlight(prev => ({ ...prev, [requestId]: { threadId, text: typeof payload.text === "string" ? payload.text : "", error: null, activities: [] } }));
        if (typeof payload.error === "string" && payload.error) setError(payload.error);
        return;
      }
      if (event.type === "backend-unavailable") {
        setError(typeof payload.message === "string" ? payload.message : "Chat backend unavailable. Reload to reconnect.");
        return;
      }
      if (threadId.length > 0) {
        const decision = accept(cursorFor(threadId), event);
        if (decision.accept.length === 0) return;
      }
      if (event.type === "delta") {
        deltas.push(requestId, typeof payload.text === "string" ? payload.text : "");
        return;
      }
      if (event.type === "tool") {
        setInFlight((prev) => {
          const current = prev[requestId];
          if (!current) return prev;
          return {
            ...prev,
            [requestId]: {
              ...current,
              activities: [
                ...current.activities,
                {
                  tool: typeof payload.tool === "string" ? payload.tool : "tool",
                  ok: payload.ok !== false,
                  summary: typeof payload.summary === "string" ? payload.summary : "",
                },
              ],
            },
          };
        });
        return;
      }
      if (event.type === "done") {
        deltas.flush();
        setInFlight((prev) => {
          if (!prev[requestId]) return prev;
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
        if (threadId === activeIdRef.current) void loadMessages(threadId);
        void reloadThreads();
        return;
      }
      if (event.type === "failed") {
        deltas.flush();
        const message = typeof payload.message === "string" ? payload.message : "the turn failed";
        setInFlight((prev) => {
          const current = prev[requestId];
          if (!current) return prev;
          return { ...prev, [requestId]: { ...current, error: message } };
        });
        if (threadId === activeIdRef.current) setError(message);
        void reloadThreads();
        return;
      }
      if (event.type === "cancelled") {
        deltas.flush();
        setInFlight((prev) => {
          if (!prev[requestId]) return prev;
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
        if (threadId === activeIdRef.current) void loadMessages(threadId);
        void reloadThreads();
        notify("Stopped — what arrived is saved");
      }
    });
  }, [cursorFor, deltas, host, loadMessages, notify, reloadThreads, setError]);

  const streaming = Object.values(inFlight).some(
    (entry) => entry.threadId === activeId && !entry.error,
  );

  const startStream = async (
    threadId: string,
    history: ChatStreamTurn[],
    thread: ChatThreadView | null,
  ) => {
    const requestId = newRequestId();
    setInFlight((prev) => ({
      ...prev,
      [requestId]: { threadId, text: "", error: null, activities: [] },
    }));
    try {
      await sendTurn(host, {
      requestId,
      threadId,
      providerId: thread?.provider_id ?? providerId,
      messages: history,
      });
    } catch (error) {
      setInFlight(prev => ({ ...prev, [requestId]: { threadId, text: "", error: String(error), activities: [] } }));
      throw error;
    }
  };

  const restream = async (plan: RestreamPlan, threadId: string) => {
    if (sending || streaming) return;
    setError(null);
    setSending(true);
    try {
      await truncateMessages(host, threadId, plan.keepSeq);
      const history: ChatStreamTurn[] = [...plan.history];
      if (plan.appendText !== undefined) {
        await appendMessage(host, threadId, "user", plan.appendText);
        history.push({ role: "user", content: plan.appendText });
      }
      setMessages(await listMessages(host, threadId));
      setInFlight((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([, entry]) => entry.threadId !== threadId)),
      );
      const thread = threads?.find((row) => row.thread_id === threadId) ?? null;
      await startStream(threadId, history, thread);
      void reloadThreads();
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  };

  const retryMessage = (message: ChatMessageView) => {
    if (!activeId || sending || streaming) return;
    const plan = planRetry(messages, message.message_id);
    if (!plan) {
      setError("There is no human turn above this reply to ask again.");
      return;
    }
    void restream(plan, activeId);
  };

  const retryLive = (requestId: string) => {
    if (!activeId || sending || streaming) return;
    const plan = planRetryFromLastUser(messages);
    if (!plan) {
      setError("There is no human turn to retry.");
      return;
    }
    setInFlight((prev) => {
      if (!prev[requestId]) return prev;
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    void restream(plan, activeId);
  };

  const submitEdit = (message: ChatMessageView, text: string) => {
    if (!activeId || sending || streaming) return;
    const plan = planEdit(messages, message.message_id);
    if (!plan) {
      setError("That message can no longer be edited.");
      return;
    }
    void restream({ ...plan, appendText: text }, activeId);
  };

  const stopStream = useCallback(() => {
    const threadId = activeIdRef.current;
    for (const [requestId, entry] of Object.entries(inFlightRef.current)) {
      if (entry.threadId !== threadId || entry.error) continue;
      void cancelTurn(host, requestId).catch((e) => setError(String(e)));
    }
  }, [host, setError]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (overlaysOpen) return;
      const running = Object.values(inFlightRef.current).some(
        (entry) => entry.threadId === activeIdRef.current && !entry.error,
      );
      if (!running) return;
      const isStop =
        event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === ".");
      if (!isStop) return;
      event.preventDefault();
      stopStream();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlaysOpen, stopStream]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || streaming) return;
    const message = withContextBlocks(text, contextFiles);
    setDraft("");
    setError(null);
    setSending(true);
    let persisted = false;
    try {
      let threadId: string | null = activeId;
      if (!threadId) {
        const thread = await createThread(host, titleFrom(text));
        threadId = thread.thread_id;
        await appendMessage(host, threadId, "user", message);
        persisted = true;
        setThreads((prev) => [thread, ...(prev ?? [])]);
        setActiveId(threadId);
      } else {
        const stored = await appendMessage(host, threadId, "user", message);
        persisted = true;
        setMessages((prev) => [...prev, stored]);
      }

      if (persisted) setContextFiles([]);

      const history: ChatStreamTurn[] = [
        ...transcriptTurns(messages),
        { role: "user" as const, content: message },
      ];
      const thread = threads?.find((row) => row.thread_id === threadId) ?? null;
      await startStream(threadId, history, thread);
    } catch (e) {
      setError(String(e));
      if (!persisted) setDraft((current) => (current ? current : text));
    } finally {
      setSending(false);
    }
  };

  const live = activeId
    ? Object.entries(inFlight).filter(([, entry]) => entry.threadId === activeId)
    : [];

  return { inFlight, sending, streaming, live, send, stopStream, retryMessage, retryLive, submitEdit, cursorFor };
}
