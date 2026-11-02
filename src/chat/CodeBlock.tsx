import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, WrapText } from "lucide-react";
import { writeClipboardText } from "../lib/clipboard";
import { highlight, languageLabel, type TokenKind } from "./highlight";

const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: "",
  comment: "tok-comment",
  string: "tok-string",
  number: "tok-number",
  keyword: "tok-keyword",
  type: "tok-type",
  function: "tok-function",
  operator: "tok-operator",
  punctuation: "tok-punctuation",
  insert: "tok-insert",
  delete: "tok-delete",
  meta: "tok-meta",
};

export function CodeBlock(props: {
  code: string;
  lang: string;
  streaming?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = languageLabel(props.lang);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    void writeClipboardText(props.code)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
      });
  }, [props.code]);

  const tokens = highlight(props.code, props.lang);

  return (
    <div
      className={`group/code my-3 overflow-hidden rounded-lg border border-border bg-code ${
        props.className ?? ""
      }`}
      data-code-block
    >
      <div className="flex h-8 items-center gap-2 border-b border-border bg-panel/60 px-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs uppercase tracking-wider text-fg-muted">
          {label}
        </span>
        {props.streaming && (
          <span className="flex items-center gap-1 text-xs text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            writing
          </span>
        )}
        <button
          type="button"
          title={wrap ? "Disable soft wrap" : "Wrap long lines"}
          aria-pressed={wrap}
          onClick={() => setWrap((v) => !v)}
          className={`rounded p-1 transition-colors hover:bg-active ${
            wrap ? "text-accent" : "text-fg-muted hover:text-fg"
          }`}
        >
          <WrapText size={12} />
        </button>
        <button
          type="button"
          title="Copy code"
          aria-label="Copy code"
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-active hover:text-fg"
        >
          {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={`max-h-[32rem] overflow-y-auto px-3.5 py-3 font-mono text-xs leading-[1.65] ${
          wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto whitespace-pre"
        }`}
      >
        <code className="text-fg">
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
          {props.code.length === 0 && <span className="text-fg-muted/60">(empty)</span>}
        </code>
      </pre>
    </div>
  );
}
