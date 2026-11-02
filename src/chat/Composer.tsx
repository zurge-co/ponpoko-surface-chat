import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type ReactNode,
} from "react";
import { Send, Square } from "lucide-react";

export function Composer(props: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onTextarea?: (node: HTMLTextAreaElement | null) => void;
  onPasteImage?: (event: ClipboardEvent<HTMLTextAreaElement>) => boolean;
  providerLabel: string;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
  leading?: ReactNode;
  hint?: ReactNode;
  context?: ReactNode;
}) {
  const { onTextarea } = props;
  const disabled = Boolean(props.disabled);
  const nodeRef = useRef<HTMLTextAreaElement | null>(null);

  const measure = useCallback((node: HTMLTextAreaElement) => {
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, []);

  const attach = useCallback(
    (node: HTMLTextAreaElement | null) => {
      nodeRef.current = node;
      if (node) measure(node);
      onTextarea?.(node);
    },
    [measure, onTextarea],
  );

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (node) measure(node);
  }, [measure, props.value]);

  const canSend = Boolean(props.value.trim()) && !disabled && !props.streaming;

  return (
    <div className="rounded-xl border border-border bg-panel shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-colors focus-within:border-accent/50">
      {props.context && (
        <div className="border-b border-border px-2.5 py-1.5">{props.context}</div>
      )}
      <textarea
        ref={attach}
        aria-label="Message"
        rows={2}
        value={props.value}
        disabled={disabled}
        onChange={(event) => props.onChange(event.target.value)}
        onPaste={(event) => {
          props.onPasteImage?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSend) props.onSend();
          }
        }}
        placeholder={props.placeholder ?? "Ask anything — Enter sends, Shift+Enter is a new line"}
        className="max-h-[200px] min-h-[58px] w-full resize-none bg-transparent px-4 py-3 text-xs leading-relaxed text-fg outline-none placeholder:text-fg-muted/60 disabled:opacity-60"
      />
      <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
        {props.leading}
        <span
          title="The model that will answer in this conversation"
          className="min-w-0 max-w-[42%] truncate font-mono text-xs text-fg-muted"
        >
          {props.providerLabel || "no model selected"}
        </span>
        {props.hint}
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={props.streaming ? props.onStop : props.onSend}
          disabled={props.streaming ? false : !canSend}
          title={
            props.streaming
              ? "Stop the reply — Esc or ⌘. What already arrived is saved"
              : "Send (Enter)"
          }
          aria-label={props.streaming ? "Stop the reply" : "Send"}
          className={
            props.streaming
              ? "flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-danger/60 hover:text-danger"
              : "flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent via-accent-lime to-accent-gold px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity disabled:opacity-35"
          }
        >
          {props.streaming ? (
            <>
              <Square size={12} className="fill-current" />
              Stop
            </>
          ) : (
            <>
              <Send size={13} />
              Send
            </>
          )}
        </button>
      </div>
    </div>
  );
}
