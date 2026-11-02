import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteThread as deleteHostThread,
  listProviders,
  listThreads,
  pinThread as pinHostThread,
  renameThread as renameHostThread,
  updateThread,
  type Host,
} from "../app/host";
import type {
  ChatProviderView,
  ChatThreadSettingsInput,
  ChatThreadView,
} from "../contracts/types";
import { useChatStore } from "../store/chatStore";
import {
  loadChatProviderId,
  loadChatRailCollapsed,
  saveChatProviderId,
  saveChatRailCollapsed,
} from "../lib/prefs";
import { useThreadSearch } from "./threadSearch";

interface ChatThreadsInput {
  host: Host;
  setError: (message: string | null) => void;
  notify: (message: string) => void;
}

export function useChatThreads({ host, setError, notify }: ChatThreadsInput) {
  const [threads, setThreads] = useState<ChatThreadView[] | null>(null);
  const [providers, setProviders] = useState<ChatProviderView[] | null>(null);
  const [providerId, setProviderId] = useState("");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railQuery, setRailQuery] = useState("");
  const activeId = useChatStore((s) => s.threadId);
  const setActiveId = useChatStore((s) => s.setThread);
  const railPrefLoaded = useRef(false);

  const railHits = useThreadSearch(host, railQuery, setError);

  const reloadThreads = useCallback(async () => {
    try {
      setThreads(await listThreads(host));
    } catch (e) {
      setError(String(e));
    }
  }, [host, setError]);

  const loadProviderChoices = useCallback(async () => {
    const preferred = await loadChatProviderId();
    const list = await listProviders(host).catch((e) => {
      setError(String(e));
      return null;
    });
    if (list === null) return;
    setProviders(list);
    setProviderId(
      preferred && list.some((p) => p.provider_id === preferred)
        ? preferred
        : (list.find((p) => p.has_key) ?? list[0])?.provider_id ?? "",
    );
  }, [host, setError]);

  useEffect(() => {
    void reloadThreads();
    void loadProviderChoices();
  }, [loadProviderChoices, reloadThreads]);

  useEffect(() => {
    if (threads === null || activeId === null) return;
    if (!threads.some((thread) => thread.thread_id === activeId)) setActiveId(null);
  }, [threads, activeId, setActiveId]);

  useEffect(() => {
    void loadChatRailCollapsed().then((collapsed) => {
      railPrefLoaded.current = true;
      setRailCollapsed(collapsed);
    });
  }, []);

  useEffect(() => {
    if (!railPrefLoaded.current) return;
    saveChatRailCollapsed(railCollapsed);
  }, [railCollapsed]);

  useEffect(() => {
    return host.broker.onEvent((event) => {
      if (event.type === "providers-changed") void loadProviderChoices();
      if (event.type === "threads-changed") void reloadThreads();
    });
  }, [host, loadProviderChoices, reloadThreads]);

  const pickProvider = useCallback((id: string) => {
    setProviderId(id);
    saveChatProviderId(id);
  }, []);

  const pinThread = (threadId: string, pinned: boolean) => {
    pinHostThread(host, threadId, pinned)
      .then((updated) => {
        setThreads((prev) =>
          prev ? prev.map((row) => (row.thread_id === updated.thread_id ? updated : row)) : prev,
        );
        notify(pinned ? "Pinned to the top" : "Unpinned");
      })
      .catch((e) => setError(String(e)));
  };

  const renameThread = (threadId: string, title: string) => {
    if (!title.trim()) return;
    renameHostThread(host, threadId, title)
      .then((updated) => {
        setThreads((prev) =>
          prev ? prev.map((row) => (row.thread_id === threadId ? { ...row, ...updated } : row)) : prev,
        );
      })
      .catch((e) => setError(String(e)));
  };

  const deleteThread = useCallback(
    (threadId: string) => {
      deleteHostThread(host, threadId)
        .then(() => {
          if (useChatStore.getState().threadId === threadId) setActiveId(null);
          void reloadThreads();
        })
        .catch((e) => setError(String(e)));
    },
    [host, reloadThreads, setActiveId, setError],
  );

  const saveThreadSettings = async (threadId: string, settings: ChatThreadSettingsInput) => {
    const updated = await updateThread(host, threadId, settings);
    setThreads((prev) =>
      prev ? prev.map((row) => (row.thread_id === updated.thread_id ? updated : row)) : prev,
    );
    notify("Thread settings saved");
  };

  return {
    threads,
    setThreads,
    providers,
    providerId,
    pickProvider,
    pinThread,
    renameThread,
    deleteThread,
    saveThreadSettings,
    railCollapsed,
    setRailCollapsed,
    railQuery,
    setRailQuery,
    railHits,
    reloadThreads,
    reloadProviders: loadProviderChoices,
  };
}
