import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { writeClipboardText } from "../lib/clipboard";

export function CopyButton(props: {
  text: string;
  label?: string;
  title?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    void writeClipboardText(props.text)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
      });
  }, [props.text]);

  return (
    <button
      type="button"
      title={props.title ?? props.label ?? "Copy"}
      aria-label={props.title ?? props.label ?? "Copy"}
      onClick={copy}
      className={
        props.className ??
        "flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-active hover:text-fg"
      }
    >
      {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
      {!props.iconOnly && (copied ? "Copied" : (props.label ?? "Copy"))}
    </button>
  );
}
