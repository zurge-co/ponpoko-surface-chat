import { POKO_NAME, POKO_SPECIES } from "../lib/poko";
import pokoLogo from "../assets/poko.svg";

export function PokoAvatar(props: { size?: "sm" | "md" }) {
  const dimension = props.size === "md" ? "h-9 w-9" : "h-7 w-7";
  return (
    <span
      aria-hidden
      className={`poko-avatar relative flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/30 bg-accent/10`}
    >
      <img src={pokoLogo} alt="" className="h-[78%] w-[78%] opacity-95" />
    </span>
  );
}

export function PokoVoice(props: { text: string }) {
  return (
    <figure className="poko-voice flex w-full max-w-lg items-start gap-3 rounded-2xl border border-border bg-panel/50 px-4 py-3.5 text-left">
      <PokoAvatar size="md" />
      <div className="min-w-0">
        <figcaption className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {POKO_NAME}
          <span className="normal-case tracking-normal text-fg-muted/60">
            {POKO_SPECIES} in Ponpoko
          </span>
        </figcaption>
        <p className="mt-1 text-xs leading-relaxed text-fg">{props.text}</p>
      </div>
    </figure>
  );
}
