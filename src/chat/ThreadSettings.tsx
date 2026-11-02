import { useEffect, useState } from "react";
import { Palette, Settings2, Type } from "lucide-react";
import type { ChatThreadView, ChatThreadSettingsInput } from "../contracts/types";
import {
  CHAT_STYLES,
  CUSTOM_INSTRUCTIONS_NOTE,
  resolveChatStyle,
} from "../lib/chatStyles";
import { useDialogFocus } from "./a11y";

export function ThreadSettings(props: {
  thread: ChatThreadView;
  onSave: (settings: ChatThreadSettingsInput) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(props.thread.title);
  const [styleId, setStyleId] = useState(resolveChatStyle(props.thread.style_id).id);
  const [systemPrompt, setSystemPrompt] = useState(props.thread.system_prompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, () => {
    if (!saving) props.onClose();
  });

  const style = resolveChatStyle(styleId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props, saving]);

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A conversation needs a title — the rail would show a blank row.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await props.onSave({
        title: trimmed,
        styleId,
        systemPrompt,
        providerId: props.thread.provider_id,
        pinned: props.thread.pinned,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-overlay px-4 pt-[8vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) props.onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Thread settings"
        className="flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border-strong bg-panel shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
          <Settings2 size={15} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-semibold text-fg">Thread settings</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              How this conversation is spoken. It never changes what a conversation can do.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
                <Type size={12} className="text-fg-muted" />
                Title
              </span>
              <input
                data-autofocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
                <Palette size={12} className="text-fg-muted" />
                Style
              </span>
              <select
                value={styleId}
                onChange={(event) => setStyleId(event.target.value)}
                className="rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent"
              >
                {CHAT_STYLES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} — {entry.description}
                  </option>
                ))}
              </select>
              <details className="mt-0.5 rounded-lg border border-border bg-base/50 px-2.5 py-1.5">
                <summary className="cursor-pointer text-xs text-fg-muted">
                  What this style sends as its preamble
                </summary>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
                  {style.preamble}
                </p>
              </details>
            </label>

            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
                <Settings2 size={12} className="text-fg-muted" />
                Custom instructions
              </span>
              <textarea
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.target.value)}
                rows={5}
                maxLength={8_000}
                placeholder="Optional. When set, this replaces the style preamble for this thread."
                className="resize-y rounded-lg border border-border bg-base px-2.5 py-2 text-xs leading-relaxed text-fg outline-none placeholder:text-fg-muted/50 focus:border-accent"
              />
              <span className="rounded-lg border border-border/70 bg-base/40 px-2.5 py-2 text-xs leading-relaxed text-fg-muted">
                {CUSTOM_INSTRUCTIONS_NOTE}
              </span>
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-2 text-xs text-danger"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={props.onClose}
            disabled={saving}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:bg-active hover:text-fg disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-accent via-accent-lime to-accent-gold px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
