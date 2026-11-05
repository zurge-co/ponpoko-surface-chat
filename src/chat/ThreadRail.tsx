import { useState, type ReactNode } from "react";
import {
  Command,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ChatThreadSearchHit, ChatThreadView, ChatProviderView } from "../contracts/types";
import { styleLabel } from "../lib/chatStyles";
import { providerOptionLabel } from "../lib/modelLabel";
import { formatRelativeTime } from "../lib/time";
import { groupThreads } from "./navigation";
import type { InFlight } from "./types";

export function ThreadRail(props: {
  threads: ChatThreadView[] | null;
  hits: ChatThreadSearchHit[] | null;
  query: string;
  onQueryChange: (query: string) => void;
  activeId: string | null;
  inFlight: Record<string, InFlight>;
  providers: ChatProviderView[] | null;
  providerId: string;
  confirmDelete: string | null;
  collapsed: boolean;
  overlay?: boolean;
  onToggleCollapsed: () => void;
  onSelect: (threadId: string) => void;
  onNew: () => void;
  onDelete: (threadId: string) => void;
  onPin: (threadId: string, pinned: boolean) => void;
  onRename: (threadId: string, title: string) => void;
  onOpenPalette: () => void;
}) {
  if (props.collapsed) {
    return (
      <aside
        aria-label="Conversation rail"
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-panel/35 py-2"
      >
        <IconButton
          label="Show conversations (⌘B)"
          onClick={props.onToggleCollapsed}
          icon={<PanelLeftOpen size={15} />}
        />
        <IconButton
          label="New conversation (⌘N)"
          onClick={props.onNew}
          icon={<MessageSquarePlus size={15} />}
        />
        <IconButton
          label="Search everything (⌘⇧P)"
          onClick={props.onOpenPalette}
          icon={<Command size={15} />}
        />
        <div className="my-1 h-px w-6 bg-border" />
        <IconButton
          label="Expand conversations to search and pin"
          onClick={props.onToggleCollapsed}
          icon={<Search size={15} />}
        />
        <div className="min-h-0 flex-1" />
      </aside>
    );
  }

  const activeProvider =
    props.providers?.find((provider) => provider.provider_id === props.providerId) ?? null;
  const activeModel = activeProvider
    ? providerOptionLabel(activeProvider)
    : "no model yet — open Chat model from the menu";
  const searching = props.query.trim().length > 0;
  const groups = groupThreads(props.threads ?? []);
  const modelOf = (thread: ChatThreadView) => {
    const provider = props.providers?.find((row) => row.provider_id === thread.provider_id);
    return provider?.model ?? "";
  };

  return (
    <aside
      aria-label="Conversations"
      className={
        props.overlay
          ? "flex h-full w-[17.5rem] shrink-0 flex-col border-r border-border bg-panel shadow-2xl"
          : "flex w-[16.5rem] shrink-0 flex-col border-r border-border bg-panel/35"
      }
    >
      <div className="flex h-11 shrink-0 items-center justify-between px-3">
        <h1 className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted">
          Conversations
        </h1>
        <div className="flex items-center gap-0.5">
          <IconButton
            label="Search everything (⌘⇧P)"
            onClick={props.onOpenPalette}
            icon={<Command size={14} />}
          />
          <IconButton
            label="New conversation (⌘N)"
            onClick={props.onNew}
            icon={<MessageSquarePlus size={14} />}
          />
          <IconButton
            label="Collapse conversations (⌘B)"
            onClick={props.onToggleCollapsed}
            icon={<PanelLeftClose size={14} />}
          />
        </div>
      </div>

      <div className="shrink-0 px-2 pb-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-base/60 px-2 py-1 focus-within:border-accent/60">
          <Search size={11} className="shrink-0 text-fg-muted" />
          <input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                props.onQueryChange("");
              }
            }}
            aria-label="Search conversations by title or content"
            placeholder="Search conversations"
            className="min-h-6 min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-muted/60"
          />
          {searching && (
            <button
              type="button"
              onClick={() => props.onQueryChange("")}
              aria-label="Clear the conversation search"
              className="rounded p-0.5 text-fg-muted transition-colors hover:bg-active hover:text-fg"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {props.threads === null ? (
          <p className="px-2 py-3 text-xs text-fg-muted">Reading the transcript…</p>
        ) : searching ? (
          props.hits === null ? (
            <p className="px-2 py-3 text-xs text-fg-muted">Searching the transcript…</p>
          ) : props.hits.length === 0 ? (
            <p className="px-2 py-3 text-xs leading-relaxed text-fg-muted">
              Nothing matches “{props.query.trim()}” — not a title, not a word in any
              conversation.
            </p>
          ) : (
            <ul className="flex flex-col gap-px">
              {props.hits.map((hit) => (
                <ThreadRow
                  key={hit.thread.thread_id}
                  thread={hit.thread}
                  snippet={hit.snippet}
                  matchCount={hit.match_count}
                  model={modelOf(hit.thread)}
                  active={hit.thread.thread_id === props.activeId}
                  inFlight={props.inFlight}
                  confirmDelete={props.confirmDelete}
                  onSelect={props.onSelect}
                  onDelete={props.onDelete}
                  onPin={props.onPin}
                  onRename={props.onRename}
                />
              ))}
            </ul>
          )
        ) : props.threads.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-fg-muted">
            No conversation yet. Ask something to start one.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="mb-2">
              <p className="px-2 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted/60">
                {group.label}
              </p>
              <ul className="flex flex-col gap-px">
                {group.threads.map((thread) => (
                  <ThreadRow
                    key={thread.thread_id}
                    thread={thread}
                    model={modelOf(thread)}
                    active={thread.thread_id === props.activeId}
                    inFlight={props.inFlight}
                    confirmDelete={props.confirmDelete}
                    onSelect={props.onSelect}
                    onDelete={props.onDelete}
                    onPin={props.onPin}
                    onRename={props.onRename}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-border px-2.5 py-2.5">
        <p className="truncate font-mono text-xs text-fg-muted" title="The model Poko thinks with">
          {activeModel}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted/70">
          Your transcript stays on this machine.
        </p>
      </div>
    </aside>
  );
}

function ThreadRow(props: {
  thread: ChatThreadView;
  snippet?: string;
  matchCount?: number;
  model: string;
  active: boolean;
  inFlight: Record<string, InFlight>;
  confirmDelete: string | null;
  onSelect: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onPin: (threadId: string, pinned: boolean) => void;
  onRename: (threadId: string, title: string) => void;
}) {
  const { thread } = props;
  const [rename, setRename] = useState({ open: false, text: thread.title });
  const renaming = rename.open;
  const text = rename.open ? rename.text : thread.title;
  const setRenaming = (open: boolean) => setRename({ open, text: thread.title });
  const setText = (next: string) => setRename({ open: rename.open, text: next });

  const entries = Object.values(props.inFlight).filter(
    (entry) => entry.threadId === thread.thread_id,
  );
  const streaming = entries.some((entry) => !entry.error);
  const failed = entries.some((entry) => entry.error);
  const style = styleLabel(thread.style_id);

  const commit = () => {
    const next = text.trim();
    setRenaming(false);
    if (next && next !== thread.title) props.onRename(thread.thread_id, next);
    else setText(thread.title);
  };

  return (
    <li className="group relative">
      {renaming ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
          className="rounded-lg bg-active px-2 py-1.5"
        >
          <input
            autoFocus
            value={text}
            aria-label="Conversation title"
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setText(thread.title);
                setRenaming(false);
              }
            }}
            className="w-full rounded border border-accent/50 bg-base px-1.5 py-1 text-xs text-fg outline-none"
          />
          <p className="mt-1 text-xs text-fg-muted">Enter or blur saves · Esc cancels</p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => props.onSelect(thread.thread_id)}
          onDoubleClick={() => setRenaming(true)}
          title={props.snippet ? `${thread.title}\n${props.snippet}` : thread.title}
          className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
            props.active ? "bg-active" : "hover:bg-hover"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {thread.pinned && <Pin size={9} className="shrink-0 text-accent" />}
            {streaming && <Loader2 size={10} className="shrink-0 animate-spin text-accent" />}
            {failed && (
              <span
                title="the last reply stopped early"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-xs leading-snug text-fg">
              {thread.title || "Untitled"}
            </span>
            {typeof props.matchCount === "number" && props.matchCount > 0 && (
              <span
                title={`${props.matchCount} matching message${props.matchCount === 1 ? "" : "s"}`}
                className="shrink-0 rounded-full border border-border px-1 font-mono text-xs text-fg-muted"
              >
                {props.matchCount}
              </span>
            )}
          </span>
          {props.snippet ? (
            <span className="mt-0.5 block truncate pl-[0.1rem] text-xs text-fg-muted">
              {props.snippet}
            </span>
          ) : (
            <span className="mt-0.5 flex items-center gap-1 pl-[0.1rem] text-xs text-fg-muted/80">
              <span className="rounded-full border border-border px-1 text-xs">{style}</span>
              {props.model && (
                <span className="max-w-[7rem] truncate font-mono text-xs text-fg-muted/70">
                  {props.model}
                </span>
              )}
              <span className="ml-auto shrink-0">{formatRelativeTime(thread.updated_at)}</span>
            </span>
          )}
        </button>
      )}

      {!renaming && (
        <span className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <RowAction
            label={thread.pinned ? "Unpin conversation" : "Pin conversation"}
            onClick={() => props.onPin(thread.thread_id, !thread.pinned)}
            icon={thread.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          />
          <RowAction
            label="Rename conversation"
            onClick={() => setRenaming(true)}
            icon={<Pencil size={11} />}
          />
          <RowAction
            label={
              props.confirmDelete === thread.thread_id
                ? "Click again to delete"
                : "Delete conversation"
            }
            onClick={() => props.onDelete(thread.thread_id)}
            icon={<Trash2 size={11} />}
            danger
            armed={props.confirmDelete === thread.thread_id}
          />
        </span>
      )}
    </li>
  );
}

function RowAction(props: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
  armed?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      className={`rounded p-1 transition-colors ${
        props.armed
          ? "bg-danger/20 text-danger"
          : props.danger
            ? "bg-panel/70 text-fg-muted hover:bg-active hover:text-danger"
            : "bg-panel/70 text-fg-muted hover:bg-active hover:text-fg"
      }`}
    >
      {props.icon}
    </button>
  );
}

function IconButton(props: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-active hover:text-fg"
    >
      {props.icon}
    </button>
  );
}
