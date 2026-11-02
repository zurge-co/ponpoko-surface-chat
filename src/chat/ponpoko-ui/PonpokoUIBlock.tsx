import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { PonpokoUIAction, PonpokoUIElement } from "../../ponpoko-ui/catalog";
import { compilePonpokoUI } from "../../ponpoko-ui/evaluate";
import type { PonpokoUIError } from "../../ponpoko-ui/lexer";
import { CopyButton } from "../CopyButton";
import { PonpokoUIView } from "./PonpokoUIView";

export interface PonpokoUIBlockProps {
  code: string;
  streaming?: boolean;
  onAction?: (action: PonpokoUIAction) => void;
}

function ErrorNote(props: { error: PonpokoUIError; code: string }) {
  return (
    <div
      role="alert"
      className="mb-2.5 rounded-lg border border-danger/35 bg-danger/5 px-3 py-2"
      data-ponpoko-ui-error
    >
      <p className="flex items-start gap-1.5 text-xs font-medium text-danger">
        <AlertTriangle size={12} className="mt-[1px] shrink-0" aria-hidden />
        <span>{props.error.message}</span>
      </p>
      <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-border/60 bg-base/60 px-2 py-1.5 font-mono text-xs leading-relaxed text-fg-muted">
        {props.code || "(empty program)"}
      </pre>
    </div>
  );
}

interface BoundaryProps {
  code: string;
  children: ReactNode;
}

interface BoundaryState {
  failed: string | null;
  code: string;
}

class PonpokoUIRenderBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: null, code: "" };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { failed: error instanceof Error ? error.message : "the program failed to render" };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.code !== state.code) return { failed: null, code: props.code };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("PonpokoUI renderer failed", error, info);
  }

  render(): ReactNode {
    if (this.state.failed !== null) {
      return (
        <ErrorNote
          error={{ message: `the program failed to render: ${this.state.failed}`, index: 0 }}
          code={this.props.code}
        />
      );
    }
    return this.props.children;
  }
}

export function PonpokoUIBlock(props: PonpokoUIBlockProps) {
  const result = useMemo(() => compilePonpokoUI(props.code), [props.code]);

  const [kept, setKept] = useState<{ code: string; tree: PonpokoUIElement } | null>(null);
  if (kept !== null && !props.code.startsWith(kept.code)) setKept(null);
  if (result.tree !== null && kept?.code !== props.code) {
    setKept({ code: props.code, tree: result.tree });
  }
  const tree =
    result.tree ?? (props.streaming && kept !== null && props.code.startsWith(kept.code) ? kept.tree : null);

  const errors = props.streaming ? [] : result.errors;
  const firstError = errors[0] ?? null;

  return (
    <div
      className="my-3 overflow-hidden rounded-xl border border-border bg-surface/60"
      data-ponpoko-ui-block
      data-ponpoko-ui-incomplete={result.incomplete ? "true" : undefined}
    >
      <div className="flex h-8 items-center gap-2 border-b border-border/70 bg-panel/40 px-3">
        <Sparkles size={11} className="shrink-0 text-accent" aria-hidden />
        <span
          className="text-xs font-medium uppercase tracking-[0.1em] text-fg-muted"
          title="Written by the model as a PonpokoUI program and rendered by Ponpoko — not HTML."
        >
          Generated UI
        </span>
        {props.streaming && (
          <span className="flex items-center gap-1 text-xs text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            writing
          </span>
        )}
        <div className="min-w-0 flex-1" />
        <CopyButton
          text={props.code}
          label="Program"
          title="Copy the PonpokoUI program the model wrote"
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-active hover:text-fg"
        />
      </div>

      <div className="px-3.5 py-3">
        {firstError && <ErrorNote error={firstError} code={props.code} />}

        {tree ? (
          <PonpokoUIRenderBoundary code={props.code}>
            <PonpokoUIView tree={tree} onAction={props.onAction} />
          </PonpokoUIRenderBoundary>
        ) : firstError ? (
          <p className="text-xs text-fg-muted">
            Nothing was rendered — fix the program and it will appear here.
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            {props.streaming
              ? "Composing the program…"
              : result.incomplete
                ? "The program stops mid-way — nothing to render yet."
                : "This program rendered nothing."}
          </p>
        )}
      </div>
    </div>
  );
}
