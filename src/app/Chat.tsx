import { useCallback, useEffect, useRef, useState } from "react";
import { transcriptMarkdown } from "../chat/history";
import { shortcutFor } from "../chat/navigation";
import { MessageList } from "../chat/MessageList";
import { ChatSidebar } from "../chat/ChatSidebar";
import { PokoSetup } from "../chat/PokoSetup";
import { ChatHeader } from "../chat/ChatHeader";
import { ChatOverlays } from "../chat/ChatOverlays";
import { ComposerBar } from "../chat/ComposerBar";
import { buildPaletteActions } from "../chat/paletteActions";
import { useChatContext } from "../chat/useChatContext";
import { useChatStream } from "../chat/useChatStream";
import { useChatThreads } from "../chat/useChatThreads";
import { useStreamResume } from "../chat/useStreamResume";
import { usePonpokoActions } from "../chat/usePonpokoActions";
import { useThreadSearch } from "../chat/threadSearch";
import { useToast } from "../chat/useToast";
import { writeClipboardText } from "../lib/clipboard";
import { chatReadiness, providerOptionLabel } from "../lib/modelLabel";
import { resolveChatStyle } from "../lib/chatStyles";
import { useMediaQuery } from "../lib/mediaQuery";
import { useChatStore } from "../store/chatStore";
import { exportThread, openSettings, type Host } from "./host";
import type {
  ChatMessageView,
  ChatThreadSearchHit,
  ChatThreadSettingsInput,
} from "../contracts/types";

export function Chat(props: { host: Host }) {
  const { host } = props;
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const threadId = useChatStore((s) => s.threadId);
  const setActiveId = useChatStore((s) => s.setThread);
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const { toast, notify } = useToast();
  const endRef = useRef<HTMLDivElement | null>(null);
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);

  const {
    threads,
    setThreads,
    providers,
    providerId,
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
    reloadProviders,
  } = useChatThreads({ host, setError, notify });

  const {
    contextFiles,
    setContextFiles,
    dragging,
    pickContextFiles,
    removeContextFile,
    onPaste,
  } = useChatContext(host, setError);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const narrow = useMediaQuery("(max-width: 900px)");

  const activeThread = threads?.find((thread) => thread.thread_id === threadId) ?? null;
  const activeStyle = resolveChatStyle(activeThread?.style_id);
  const threadProviderId = activeThread?.provider_id ?? null;
  const effectiveProviderId =
    threadProviderId && providers?.some((p) => p.provider_id === threadProviderId)
      ? threadProviderId
      : providerId;
  const activeProvider = providers?.find((p) => p.provider_id === effectiveProviderId) ?? null;
  const modelLabel = activeProvider ? providerOptionLabel(activeProvider) : "";
  const readiness = chatReadiness(providers, effectiveProviderId);
  const configured = readiness === true;
  const overlaysOpen = Boolean(settingsOpen || commandOpen);

  const {
    inFlight,
    sending,
    streaming,
    live,
    send,
    stopStream,
    retryMessage,
    retryLive,
    submitEdit,
    cursorFor,
  } = useChatStream({
    host,
    activeId: threadId,
    messages,
    threads,
    draft,
    contextFiles,
    providerId: effectiveProviderId,
    overlaysOpen,
    setError,
    notify,
    setActiveId,
    setMessages,
    setThreads,
    setDraft,
    setContextFiles,
    reloadThreads,
  });

  const paletteHits = useThreadSearch(host, paletteQuery, setError);

  useStreamResume({
    host,
    threadId,
    cursor: threadId ? cursorFor(threadId) : null,
    onReloaded: () => {
      setError(null);
      notify("Reconnected — the transcript was reloaded from Ponpoko");
      void reloadThreads();
    },
    onError: (message) => setError(message),
  });

  const focusDraftEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.scrollTop = textarea.scrollHeight;
    });
  }, [textarea]);

  const { openExternal, handlePonpokoUIAction } = usePonpokoActions({
    host,
    setError,
    notify,
    setDraft,
    focusDraftEnd,
  });

  const selectThread = (nextThreadId: string) => {
    setActiveId(nextThreadId);
    setError(null);
    setConfirmDelete(null);
    setSettingsOpen(false);
    setEditingId(null);
    setTitleEditing(false);
    setDrawerOpen(false);
  };

  const newThread = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setDraft("");
    setContextFiles([]);
    setSettingsOpen(false);
    setEditingId(null);
    setTitleEditing(false);
    setDrawerOpen(false);
    requestAnimationFrame(() => textarea?.focus());
  }, [setActiveId, setContextFiles, setDraft, textarea]);

  const toggleRail = useCallback(() => {
    if (narrow) setDrawerOpen((open) => !open);
    else setRailCollapsed((current) => !current);
  }, [narrow, setRailCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shortcutFor(event);
      if (!action) return;
      if (action === "command-palette") {
        event.preventDefault();
        setPaletteQuery("");
        setCommandOpen((open) => !open);
        return;
      }
      if (overlaysOpen) return;
      event.preventDefault();
      if (action === "new-chat") newThread();
      else if (action === "toggle-rail") toggleRail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newThread, overlaysOpen, toggleRail]);

  const removeThread = (targetId: string) => {
    if (confirmDelete !== targetId) {
      setConfirmDelete(targetId);
      return;
    }
    setConfirmDelete(null);
    deleteThread(targetId);
  };

  const togglePinActive = () => {
    if (!activeThread) return;
    pinThread(activeThread.thread_id, !activeThread.pinned);
  };

  const saveTitle = () => {
    if (!titleEditing) return;
    setTitleEditing(false);
    const next = titleDraft.trim();
    if (!threadId || !next || next === activeThread?.title) return;
    renameThread(threadId, next);
  };

  const applyThreadSettings = async (settings: ChatThreadSettingsInput) => {
    if (!threadId) throw new Error("Start a conversation before changing its settings.");
    await saveThreadSettings(threadId, settings);
    setSettingsOpen(false);
  };

  const copyTranscript = async () => {
    try {
      await writeClipboardText(transcriptMarkdown(activeThread?.title ?? "", messages));
      notify("Transcript copied as Markdown");
    } catch {
      setError("Could not copy — the clipboard is unavailable");
    }
  };

  const exportActiveThread = () => {
    if (!threadId) return;
    void (async () => {
      try {
        const written = await exportThread(host, threadId);
        if (written) notify(`Exported to ${written}`);
        else if (written === null) notify("Export cancelled");
      } catch (e) {
        setError(String(e));
      }
    })();
  };

  const paletteThreads: ChatThreadSearchHit[] = paletteQuery.trim()
    ? (paletteHits ?? [])
    : (threads ?? []).map((thread) => ({ thread, snippet: "", match_count: 0 }));

  const paletteActions = buildPaletteActions({
    newThread,
    openThreadSettings: () => setSettingsOpen(true),
    exportThread: exportActiveThread,
    openPalette: () => { void openSettings(host, "palette").catch((error: unknown) => setError(String(error))); },
  });

  const rail = (
    <ChatSidebar
      narrow={narrow}
      drawerOpen={drawerOpen}
      onCloseDrawer={() => setDrawerOpen(false)}
      threads={threads}
      hits={railHits}
      query={railQuery}
      onQueryChange={setRailQuery}
      activeId={threadId}
      inFlight={inFlight}
      providers={providers}
      providerId={providerId}
      confirmDelete={confirmDelete}
      collapsed={narrow ? false : railCollapsed}
      overlay={narrow}
      onToggleCollapsed={toggleRail}
      onSelect={selectThread}
      onNew={newThread}
      onDelete={removeThread}
      onPin={pinThread}
      onRename={renameThread}
      onOpenPalette={() => setCommandOpen(true)}
    />
  );

  return (
    <div className="flex h-full min-h-0 bg-base">
      {rail}

      <main aria-label="Conversation" className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          narrow={narrow}
          thread={activeThread}
          messageCount={messages.length}
          styleName={activeStyle.name}
          modelLabel={modelLabel}
          titleEditing={titleEditing}
          titleDraft={titleDraft}
          canCopy={messages.length > 0}
          canExport={Boolean(threadId)}
          onOpenRail={() => setDrawerOpen(true)}
          onTitleDraft={setTitleDraft}
          onBeginTitle={() => {
            setTitleDraft(activeThread?.title ?? "");
            setTitleEditing(true);
          }}
          onSaveTitle={saveTitle}
          onCancelTitle={() => setTitleEditing(false)}
          onTogglePin={togglePinActive}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          onCopyTranscript={() => void copyTranscript()}
          onExport={exportActiveThread}
        />

        <MessageList
          host={host}
          messages={messages}
          live={live}
          modelLabel={modelLabel}
          endRef={endRef}
          conversationId={threadId}
          busy={sending || streaming}
          editingId={editingId}
          readiness={readiness}
          setup={
            configured ? undefined : (
              <PokoSetup
                host={host}
                notify={(message) => {
                  notify(message);
                  void reloadProviders();
                }}
              />
            )
          }
          onError={setError}
          onRetry={retryMessage}
          onRetryLive={retryLive}
          onBeginEdit={(message) => setEditingId(message.message_id)}
          onCancelEdit={() => setEditingId(null)}
          onSubmitEdit={submitEdit}
          onOpenLink={openExternal}
          onPonpokoUIAction={handlePonpokoUIAction}
        />

        {configured && (
          <ComposerBar
            error={error}
            provider={activeProvider}
            draft={draft}
            sending={sending}
            streaming={streaming}
            contextFiles={contextFiles}
            dragging={dragging}
            onTextarea={setTextarea}
            modelLabel={modelLabel}
            onChange={setDraft}
            onSend={() => void send()}
            onStop={stopStream}
            onAddContext={() => void pickContextFiles()}
            onRemoveContext={removeContextFile}
            onPasteImage={onPaste}
          />
        )}
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-accent/40 bg-panel px-3.5 py-1.5 text-xs text-fg shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          {toast}
        </div>
      )}

      <ChatOverlays
        commandOpen={commandOpen}
        paletteQuery={paletteQuery}
        paletteHits={paletteHits}
        paletteThreads={paletteThreads}
        paletteActions={paletteActions}
        onQueryChange={setPaletteQuery}
        onPickThread={(picked) => {
          setCommandOpen(false);
          selectThread(picked);
        }}
        onCloseCommand={() => {
          setCommandOpen(false);
          setPaletteQuery("");
          requestAnimationFrame(() => textarea?.focus());
        }}
        settingsOpen={settingsOpen}
        thread={activeThread}
        onSaveThreadSettings={applyThreadSettings}
        onCloseSettings={() => setSettingsOpen(false)}
      />
    </div>
  );
}
