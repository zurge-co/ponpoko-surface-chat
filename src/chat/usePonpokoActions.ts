import { useCallback } from "react";
import { openLink, type Host } from "../app/host";
import { writeClipboardText } from "../lib/clipboard";
import type { PonpokoUIAction } from "../ponpoko-ui/catalog";

interface PonpokoActionsInput {
  host: Host;
  setError: (message: string | null) => void;
  notify: (message: string) => void;
  setDraft: (draft: string | ((current: string) => string)) => void;
  focusDraftEnd: () => void;
}

export function usePonpokoActions({
  host,
  setError,
  notify,
  setDraft,
  focusDraftEnd,
}: PonpokoActionsInput) {
  const openExternal = useCallback(
    (href: string) => {
      void openLink(host, href).catch((e) => setError(String(e)));
    },
    [host, setError],
  );

  const handlePonpokoUIAction = useCallback(
    (action: PonpokoUIAction) => {
      switch (action.name) {
        case "ask":
          setError(null);
          setDraft(action.value);
          focusDraftEnd();
          break;
        case "insert":
          setError(null);
          setDraft((current) => (current.trim() ? `${current}\n${action.value}` : action.value));
          focusDraftEnd();
          break;
        case "copy":
          void writeClipboardText(action.value)
            .then(() => notify("Copied to the clipboard"))
            .catch(() => setError("Could not copy — the clipboard is unavailable"));
          break;
        case "open":
          openExternal(action.value);
          break;
      }
    },
    [focusDraftEnd, notify, openExternal, setDraft, setError],
  );

  return { openExternal, handlePonpokoUIAction };
}
