import type {
  ChatThreadSearchHit,
  ChatThreadSettingsInput,
  ChatThreadView,
} from "../contracts/types";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { ThreadSettings } from "./ThreadSettings";

export function ChatOverlays(props: {
  commandOpen: boolean;
  paletteQuery: string;
  paletteHits: ChatThreadSearchHit[] | null;
  paletteThreads: ChatThreadSearchHit[];
  paletteActions: PaletteAction[];
  onQueryChange: (query: string) => void;
  onPickThread: (threadId: string) => void;
  onCloseCommand: () => void;
  settingsOpen: boolean;
  thread: ChatThreadView | null;
  onSaveThreadSettings: (settings: ChatThreadSettingsInput) => Promise<void>;
  onCloseSettings: () => void;
}) {
  return (
    <>
      {props.commandOpen && (
        <CommandPalette
          threads={props.paletteThreads}
          actions={props.paletteActions}
          searching={props.paletteQuery.trim().length > 0 && props.paletteHits === null}
          onQueryChange={props.onQueryChange}
          onPickThread={props.onPickThread}
          onClose={props.onCloseCommand}
        />
      )}

      {props.settingsOpen && props.thread && (
        <ThreadSettings
          thread={props.thread}
          onSave={props.onSaveThreadSettings}
          onClose={props.onCloseSettings}
        />
      )}
    </>
  );
}
