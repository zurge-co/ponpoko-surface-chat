import {
  Command,
  Copy,
  Download,
  PanelLeft,
  Pin,
  PinOff,
  SlidersHorizontal,
} from "lucide-react";
import type { ChatThreadView } from "../contracts/types";

export function ChatHeader(props: {
  narrow: boolean;
  thread: ChatThreadView | null;
  messageCount: number;
  styleName: string;
  modelLabel: string;
  titleEditing: boolean;
  titleDraft: string;
  canCopy: boolean;
  canExport: boolean;
  onOpenRail: () => void;
  onTitleDraft: (value: string) => void;
  onBeginTitle: () => void;
  onSaveTitle: () => void;
  onCancelTitle: () => void;
  onTogglePin: () => void;
  onOpenSettings: () => void;
  onOpenCommand: () => void;
  onCopyTranscript: () => void;
  onExport: () => void;
}) {
  const thread = props.thread;
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-5">
      {props.narrow && (
        <button
          type="button"
          title="Show conversations (⌘B)"
          aria-label="Show conversations"
          onClick={props.onOpenRail}
          className="shrink-0 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-active hover:text-fg"
        >
          <PanelLeft size={14} />
        </button>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {thread && props.titleEditing ? (
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              props.onSaveTitle();
            }}
          >
            <input
              autoFocus
              value={props.titleDraft}
              aria-label="Conversation title"
              onChange={(event) => props.onTitleDraft(event.target.value)}
              onBlur={props.onSaveTitle}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  props.onCancelTitle();
                }
              }}
              className="w-full rounded border border-accent/50 bg-base px-1.5 py-0.5 text-xs font-semibold text-fg outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={!thread}
            onClick={props.onBeginTitle}
            title={thread ? "Click to rename this conversation" : undefined}
            className="min-h-6 min-w-0 truncate text-left text-xs font-semibold text-fg transition-colors enabled:hover:text-accent disabled:cursor-default"
          >
            {thread?.title || "New conversation"}
          </button>
        )}
        {thread && (
          <span
            title="Stored turns in this conversation"
            className="shrink-0 font-mono text-xs text-fg-muted/70"
          >
            {props.messageCount} {props.messageCount === 1 ? "message" : "messages"}
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={!thread}
        onClick={props.onTogglePin}
        title={thread?.pinned ? "Unpin this conversation" : "Pin this conversation"}
        aria-label={thread?.pinned ? "Unpin conversation" : "Pin conversation"}
        className={`rounded-md p-1.5 transition-colors disabled:opacity-35 ${
          thread?.pinned
            ? "text-accent hover:bg-active"
            : "text-fg-muted hover:bg-active hover:text-fg"
        }`}
      >
        {thread?.pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      <button
        type="button"
        disabled={!thread}
        onClick={props.onOpenSettings}
        title={
          thread
            ? "Thread settings — style, model and custom instructions"
            : "Start a conversation, then configure its style and model"
        }
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-panel/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-40"
      >
        <SlidersHorizontal size={11} />
        {props.styleName}
      </button>
      {props.modelLabel && (
        <span
          title="The model answering in this conversation"
          className="hidden max-w-[18rem] truncate rounded-full border border-border bg-panel/60 px-2.5 py-1 font-mono text-xs text-fg-muted sm:block"
        >
          {props.modelLabel}
        </span>
      )}
      <button
        type="button"
        title="Search everything — conversations, prompts and actions (⌘K)"
        aria-label="Command palette"
        onClick={props.onOpenCommand}
        className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-active hover:text-fg"
      >
        <Command size={14} />
      </button>
      <button
        type="button"
        disabled={!props.canCopy}
        title="Copy the transcript as Markdown"
        aria-label="Copy transcript"
        onClick={props.onCopyTranscript}
        className="chat-secondary-action rounded-md p-1.5 text-fg-muted transition-colors hover:bg-active hover:text-fg disabled:opacity-35"
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        disabled={!props.canExport}
        title="Export this conversation as Markdown to a file you choose"
        aria-label="Export conversation"
        onClick={props.onExport}
        className="chat-secondary-action rounded-md p-1.5 text-fg-muted transition-colors hover:bg-active hover:text-fg disabled:opacity-35"
      >
        <Download size={14} />
      </button>
    </header>
  );
}
