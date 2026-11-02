import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { contextTotals, formatBytes, type ContextFile } from "./context";

function ChipIcon(props: { kind: ContextFile["kind"] }) {
  if (props.kind === "image") return <ImageIcon size={10} className="shrink-0 text-accent" />;
  if (props.kind === "pdf") return <FileText size={10} className="shrink-0 text-accent" />;
  return <Paperclip size={10} className="shrink-0 text-accent" />;
}

export function ContextChips(props: {
  files: readonly ContextFile[];
  onAdd: () => void;
  onRemove: (path: string) => void;
  disabled?: boolean;
  dragging?: boolean;
}) {
  const totals = contextTotals(props.files);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {props.files.map((file) => (
        <span
          key={file.path}
          title={`${file.path} — ${file.kind}`}
          className="flex max-w-full items-center gap-1.5 rounded-full border border-border bg-base/70 py-0.5 pl-2 pr-1 text-xs text-fg-muted"
        >
          <ChipIcon kind={file.kind} />
          <span className="max-w-[12rem] truncate font-mono text-xs text-fg">
            {file.name}
          </span>
          <span className="shrink-0 text-xs uppercase tracking-wide text-fg-muted/70">
            {file.kind}
          </span>
          <span className="shrink-0 text-fg-muted/80">{formatBytes(file.bytes)}</span>
          <button
            type="button"
            onClick={() => props.onRemove(file.path)}
            disabled={props.disabled}
            aria-label={`Remove ${file.name} from the context`}
            title={`Remove ${file.name} from the context`}
            className="rounded-full p-0.5 text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger disabled:opacity-35"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={props.onAdd}
        disabled={props.disabled}
        title="Attach text (256 KiB), an image (5 MiB) or a PDF (8 MiB)"
        className={`flex min-h-6 items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs transition-colors disabled:opacity-35 ${
          props.dragging
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-fg-muted hover:border-accent hover:text-fg"
        }`}
      >
        <Paperclip size={10} />
        {props.dragging ? "Drop to attach" : "Add context"}
      </button>

      {props.files.length > 0 && (
        <span
          title="A rough estimate — Ponpoko shows elapsed time, not a made-up token count"
          className="font-mono text-xs text-fg-muted/80"
        >
          {formatBytes(totals.bytes)} · ~{totals.tokens} tokens (rough)
        </span>
      )}
    </div>
  );
}
