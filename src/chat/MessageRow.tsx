import { useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import type { PonpokoUIAction } from "../ponpoko-ui/catalog";
import { Markdown } from "./Markdown.tsx";
import { PokoAvatar } from "./Poko";
import { POKO_NAME } from "../lib/poko";
import { CopyButton } from "./CopyButton";
import { formatElapsed, type ChatMessageMeta } from "./history";
import type { ToolActivity } from "./types";

export function MessageRow(props: {
  role: string;
  text: string;
  modelLabel?: string;
  meta?: ChatMessageMeta | null;
  activities?: ToolActivity[];
  streaming?: boolean;
  failed?: boolean;
  editing?: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (text: string) => void;
  onOpenLink?: (href: string) => void;
  onPonpokoUIAction?: (action: PonpokoUIAction) => void;
}) {
  const mine = props.role === "user";
  const [draft, setDraft] = useState({ editing: Boolean(props.editing), text: props.text });
  const editText = draft.text;
  if (Boolean(props.editing) !== draft.editing) {
    setDraft({ editing: Boolean(props.editing), text: props.text });
  }

  if (props.role === "tool") {
    const ok = props.meta?.ok !== false;
    return (
      <details className="group/tool rounded-xl border border-border bg-panel/50 px-3 py-1.5 text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-fg-muted [&::-webkit-details-marker]:hidden">
          <span
            title={ok ? "The tool ran" : "The tool refused"}
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-accent-lime" : "bg-danger"}`}
          />
          <span className="shrink-0 font-mono text-xs text-fg">
            {props.meta?.tool ?? "tool"}
          </span>
          <span className="min-w-0 truncate">{props.meta?.summary ?? (ok ? "ran" : "refused")}</span>
          {props.meta?.call_id && (
            <span className="ml-auto shrink-0 font-mono text-xs text-fg-muted/60">
              {props.meta.call_id}
            </span>
          )}
        </summary>
        <pre className="mt-1.5 max-h-64 select-text overflow-auto whitespace-pre-wrap break-words rounded-lg bg-elevated/40 p-2 font-mono text-xs leading-relaxed text-fg-muted">
          {props.text}
        </pre>
      </details>
    );
  }

  if (mine) {
    if (props.editing && props.onSubmitEdit) {
      const save = () => {
        const text = editText.trim();
        if (text) props.onSubmitEdit?.(text);
      };
      return (
        <div className="flex flex-col items-end gap-1.5">
          <div className="w-full max-w-[88%] rounded-2xl rounded-br-md border border-accent/50 bg-elevated/65 px-3 py-2.5 shadow-sm">
            <textarea
              aria-label="Edit your message"
              autoFocus
              rows={Math.min(10, Math.max(2, editText.split("\n").length))}
              value={editText}
              onChange={(event) => setDraft({ editing: draft.editing, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  props.onCancelEdit?.();
                } else if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  save();
                }
              }}
              className="w-full resize-y bg-transparent text-xs leading-relaxed text-fg outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="mr-auto text-xs text-fg-muted">
                Enter resends · Shift+Enter is a new line · Esc cancels
              </span>
              <button
                type="button"
                onClick={props.onCancelEdit}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!editText.trim()}
                className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-35"
              >
                Save &amp; resend
              </button>
            </div>
          </div>
          <p className="pr-1 text-xs text-fg-muted">
            Everything after this message will be removed and the answer regenerated.
          </p>
        </div>
      );
    }

    return (
      <div className="group flex flex-col items-end gap-1.5">
        <div className="max-w-[88%] select-text rounded-2xl rounded-br-md border border-border-strong bg-elevated/65 px-4 py-2.5 text-xs leading-relaxed text-fg shadow-sm">
          <Markdown text={props.text} onOpenLink={props.onOpenLink} />
        </div>
        <div className="flex items-center gap-1 pr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <CopyButton text={props.text} label="Copy" title="Copy your message" />
          {props.onEdit && (
            <button
              type="button"
              title="Edit this message and regenerate the answer"
              onClick={props.onEdit}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-active hover:text-fg"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  const label = props.meta?.model?.trim() || props.modelLabel?.trim() || "Model";
  const elapsed =
    typeof props.meta?.elapsed_ms === "number" ? formatElapsed(props.meta.elapsed_ms) : "";

  return (
    <div className="group flex flex-col gap-1">
      <div className="flex min-h-5 items-center gap-2">
        <PokoAvatar />
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-fg">
          {POKO_NAME}
        </span>
        <span className="max-w-[16rem] truncate font-mono text-xs text-fg-muted/70">
          {label}
        </span>
        {elapsed && (
          <span
            title="How long this reply took to stream"
            className="font-mono text-xs text-fg-muted/70"
          >
            {elapsed}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {props.onRetry && !props.streaming && (
            <button
              type="button"
              title="Retry — this removes the reply (and anything after it) and asks again"
              onClick={props.onRetry}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-active hover:text-fg"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          )}
          <CopyButton text={props.text} label="Copy" title="Copy reply" />
        </div>
      </div>
      {props.activities && props.activities.length > 0 && (
        <ul aria-label="Tools this reply used" className="mb-1 flex flex-col gap-1">
          {props.activities.map((activity, index) => (
            <li
              key={`${activity.tool}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-panel/40 px-2.5 py-1 text-xs text-fg-muted"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  activity.ok ? "bg-accent-lime" : "bg-danger"
                }`}
              />
              <span className="font-mono text-xs text-fg">{activity.tool}</span>
              <span className="min-w-0 truncate">{activity.summary}</span>
              <span className="ml-auto shrink-0 text-xs uppercase tracking-[0.08em] text-fg-muted/60">
                {activity.ok ? "ran" : "refused"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="poko-turn select-text pl-9 text-xs leading-relaxed text-fg">
        <Markdown
          text={props.text}
          streaming={props.streaming}
          onOpenLink={props.onOpenLink}
          onPonpokoUIAction={props.onPonpokoUIAction}
        />
        {props.streaming && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-accent align-middle" />
        )}
        {props.failed && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-danger">
              the reply stopped early — what arrived is above
            </p>
            {props.onRetry && (
              <button
                type="button"
                onClick={props.onRetry}
                className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg"
              >
                <RefreshCw size={10} />
                Retry
              </button>
            )}
          </div>
        )}
        {props.meta?.stopped && (
          <p className="mt-2 text-xs text-fg-muted">
            Stopped — what arrived above is saved.
          </p>
        )}
      </div>
    </div>
  );
}
