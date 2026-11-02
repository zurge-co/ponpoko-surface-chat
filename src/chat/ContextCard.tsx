import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { formatBytes, type ContextFile } from "./context";

function KindIcon(props: { kind: ContextFile["kind"] }) {
  if (props.kind === "image") return <ImageIcon size={12} className="shrink-0 text-accent" />;
  if (props.kind === "pdf") return <FileText size={12} className="shrink-0 text-accent" />;
  return <Paperclip size={12} className="shrink-0 text-accent" />;
}

const KIND_LABEL: Record<ContextFile["kind"], string> = {
  text: "text",
  image: "image",
  pdf: "PDF",
};

export function ContextCard(props: { file: ContextFile; complete?: boolean }) {
  const [open, setOpen] = useState(false);
  const kind = props.file.kind;
  const label = kind === "image" && props.file.mediaType
    ? props.file.mediaType.replace("image/", "").toUpperCase()
    : KIND_LABEL[kind];
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-panel/55">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        title={
          kind === "image"
            ? open
              ? "Hide the picture"
              : "Show the picture"
            : open
              ? "Hide the file content"
              : "Show the file content"
        }
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-hover"
      >
        {open ? (
          <ChevronDown size={12} className="shrink-0 text-fg-muted" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-fg-muted" />
        )}
        <KindIcon kind={kind} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
          {props.file.name}
        </span>
        <span className="shrink-0 rounded-full border border-border px-1.5 text-xs text-fg-muted">
          {label}
        </span>
        <span className="shrink-0 font-mono text-xs text-fg-muted">
          {formatBytes(props.file.bytes)}
        </span>
      </button>
      <p
        title={props.file.path}
        className="truncate px-2.5 pb-1.5 pl-[2.4rem] font-mono text-xs text-fg-muted/70"
      >
        {props.file.path}
      </p>
      {props.complete === false && (
        <p className="border-t border-border px-2.5 py-1.5 text-xs text-fg-muted">
          This block was cut short — what arrived is shown.
        </p>
      )}
      {open && kind === "image" && (
        <p className="border-t border-border bg-base/60 px-2.5 py-2 text-xs leading-relaxed text-fg-muted">
          A picture of {formatBytes(props.file.bytes)} is sent to the model as it is, not as text.
          Ponpoko reads it back from {props.file.path} when the turn starts, so the file must stay
          where it is.
        </p>
      )}
      {open && kind !== "image" && (
        <pre className="max-h-[20rem] overflow-auto border-t border-border bg-base/60 px-2.5 py-2 font-mono text-xs leading-relaxed text-fg-muted">
          {props.file.content}
        </pre>
      )}
    </div>
  );
}
