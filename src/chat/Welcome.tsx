import type { ReactNode } from "react";
import { Blocks, Palette, Settings2 } from "lucide-react";
import { openSettings, type Host } from "../app/host";
import { pokoGreeting, pokoNeedsSetup, type PokoReadiness } from "../lib/poko";
import { PokoVoice } from "./Poko";

export const SETTINGS_DOORS = [
  { id: "model", label: "Chat model", hint: "The provider, key and model Poko thinks with" },
  { id: "surfaces", label: "Surfaces", hint: "Install and remove surfaces" },
  { id: "palette", label: "Palette", hint: "The colours Ponpoko draws with" },
] as const;

const DOOR_ICONS = {
  model: Settings2,
  surfaces: Blocks,
  palette: Palette,
} as const;

export function SettingsDoors(props: { host: Host; onError: (message: string) => void }) {
  return (
    <div
      role="group"
      aria-label="Ponpoko settings"
      className="mt-8 flex w-full max-w-lg flex-wrap items-stretch justify-center gap-2"
    >
      {SETTINGS_DOORS.map((door) => {
        const Icon = DOOR_ICONS[door.id];
        return (
          <button
            key={door.id}
            type="button"
            title={door.hint}
            aria-label={`Open ${door.label}`}
            onClick={() => {
              void openSettings(props.host, door.id).catch((e) => props.onError(String(e)));
            }}
            className="flex min-w-32 flex-1 items-center gap-2 rounded-lg border border-border bg-panel/70 px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:border-accent/40 hover:bg-hover hover:text-fg"
          >
            <Icon size={14} strokeWidth={1.8} className="shrink-0 text-accent" />
            <span className="min-w-0 truncate">{door.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Welcome(props: {
  host: Host;
  readiness: PokoReadiness;
  setup?: ReactNode;
  onError: (message: string) => void;
}) {
  const needsSetup = pokoNeedsSetup(props.readiness);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-2 pt-12 text-center">
      <PokoVoice text={pokoGreeting(props.readiness)} />
      {props.readiness === null ? null : needsSetup ? (
        props.setup
      ) : (
        <SettingsDoors host={props.host} onError={props.onError} />
      )}

      <p className="mt-8 max-w-md text-xs leading-relaxed text-fg-muted/70">
        ⌘K holds every action. Your transcript stays on this machine, in Ponpoko's own database.
      </p>
    </div>
  );
}
