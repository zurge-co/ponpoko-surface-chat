import { useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { openSettings, type Host } from "../app/host";
import { POKO_NAME, POKO_SETUP_NOTE, POKO_SETUP_TITLE } from "../lib/poko";
import { PokoAvatar } from "./Poko";

export function PokoSetup(props: { host: Host; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await openSettings(props.host, "model");
      props.notify(
        "Ponpoko's Chat model settings are open in the host window — a provider, a key and a model are all it needs.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={POKO_SETUP_TITLE}
      className="poko-setup mt-4 w-full max-w-lg rounded-2xl border border-accent/35 bg-panel/60 px-4 py-4 text-left"
    >
      <div className="flex items-start gap-3">
        <PokoAvatar />
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold text-fg">{POKO_SETUP_TITLE}</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">{POKO_SETUP_NOTE}</p>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-border/70 bg-base/40 px-2.5 py-2 text-xs leading-relaxed text-fg-muted">
        The provider, its key and the model belong to Ponpoko, not to this Chat window: no key ever
        enters this page, and {POKO_NAME} composes its own identity on the host side.
      </p>

      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void open()}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent via-accent-lime to-accent-gold px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity disabled:opacity-35"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Settings2 size={12} />}
          Open Chat model settings
        </button>
      </div>
    </section>
  );
}
