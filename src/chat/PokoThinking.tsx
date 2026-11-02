import type { ToolActivity } from "./types";
import { PokoAvatar } from "./Poko";
import { POKO_NAME } from "../lib/poko";

export function PokoThinking(props: { activities?: ToolActivity[] }) {
  const recent = props.activities?.length
    ? props.activities[props.activities.length - 1]
    : null;
  const doing = recent
    ? `${recent.tool} — ${recent.summary}`
    : "reading what you asked for";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${POKO_NAME} is thinking`}
      className="poko-thinking flex items-start gap-3"
    >
      <PokoAvatar size="md" />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-fg">
            {POKO_NAME}
          </span>
          <span className="text-xs text-fg-muted">
            {recent ? "is in the workshop" : "is thinking"}
          </span>
        </p>
        <p className="mt-1.5 flex items-center gap-1.5">
          <span aria-hidden className="poko-dot" />
          <span aria-hidden className="poko-dot" />
          <span aria-hidden className="poko-dot" />
          <span className="ml-1.5 min-w-0 truncate text-xs text-fg-muted">{doing}</span>
        </p>
      </div>
    </div>
  );
}
