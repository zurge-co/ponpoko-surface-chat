import type { ClipboardEvent } from "react";
import type { ChatProviderView } from "../contracts/types";
import { Composer } from "./Composer";
import { ContextChips } from "./ContextChips";
import type { ContextFile } from "./context";

export function ComposerBar(props: {
  error: string | null;
  provider: ChatProviderView | null;
  draft: string;
  sending: boolean;
  streaming: boolean;
  contextFiles: ContextFile[];
  dragging: boolean;
  onTextarea: (node: HTMLTextAreaElement | null) => void;
  modelLabel: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onAddContext: () => void;
  onRemoveContext: (path: string) => void;
  onPasteImage: (event: ClipboardEvent<HTMLTextAreaElement>) => boolean;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-gradient-to-t from-base via-base to-base/60 px-3 pb-3 pt-3 sm:px-5 sm:pb-4">
      <div className="mx-auto w-full max-w-[46rem]">
        {props.error && (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {props.error}
          </p>
        )}

        <Composer
          value={props.draft}
          onChange={props.onChange}
          onSend={props.onSend}
          onStop={props.onStop}
          onTextarea={props.onTextarea}
          onPasteImage={props.onPasteImage}
          providerLabel={props.modelLabel}
          disabled={props.sending}
          streaming={props.streaming}
          context={
            <ContextChips
              files={props.contextFiles}
              dragging={props.dragging}
              disabled={props.sending || props.streaming}
              onAdd={props.onAddContext}
              onRemove={props.onRemoveContext}
            />
          }
        />
      </div>
    </div>
  );
}
