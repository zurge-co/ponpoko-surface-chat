import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, Terminal } from "lucide-react";
import type { ChatThreadSearchHit } from "../contracts/types";
import { rankPalette, wrapIndex, type PaletteCandidate } from "./navigation";
import { useDialogFocus } from "./a11y";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

interface Item extends PaletteCandidate {
  run: () => void;
}

export function CommandPalette(props: {
  threads: ChatThreadSearchHit[];
  actions: readonly PaletteAction[];
  searching?: boolean;
  onQueryChange?: (query: string) => void;
  onPickThread: (threadId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState({ key: "", index: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, props.onClose);
  const { threads, actions, onPickThread } = props;

  const items = useMemo<Item[]>(() => {
    const threadItems: Item[] = threads.slice(0, 8).map((hit) => ({
      id: `thread-${hit.thread.thread_id}`,
      group: "Conversations",
      label: hit.thread.title || "Untitled",
      hint:
        hit.snippet ||
        (hit.thread.pinned ? "pinned" : "") ||
        undefined,
      keywords: hit.snippet,
      run: () => onPickThread(hit.thread.thread_id),
    }));

    const actionItems: Item[] = rankPalette(
      actions.map((action) => ({
        id: `action-${action.id}`,
        group: "Actions",
        label: action.label,
        hint: action.hint,
        keywords: action.keywords,
        run: action.run,
      })),
      query,
    );

    return [...threadItems, ...actionItems];
  }, [threads, actions, onPickThread, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selectionKey = `${query}\u0000${threads.length}`;
  const selected = selection.key === selectionKey ? selection.index : 0;
  if (selection.key !== selectionKey) setSelection({ key: selectionKey, index: 0 });
  const selectAt = (index: number) => setSelection({ key: selectionKey, index });

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-selected="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [selected, items]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    props.onClose();
    item.run();
  };

  const move = (delta: number) => {
    if (items.length === 0) return;
    selectAt(wrapIndex(selected, items.length, delta));
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-overlay px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border-strong bg-panel shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          <Search size={14} className="shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            data-autofocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              props.onQueryChange?.(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(items[selected]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                props.onClose();
              }
            }}
            aria-label="Search conversations and actions"
            placeholder="Search conversations and actions"
            className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-muted/60"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs text-fg-muted">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-fg-muted">
              {props.searching
                ? "Searching the transcript…"
                : `Nothing matches “${query.trim()}”.`}
            </p>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selected;
              const header = item.group !== lastGroup ? item.group : "";
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {header && (
                    <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted/70">
                      {header}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onMouseEnter={() => selectAt(index)}
                    onClick={() => choose(item)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isSelected ? "bg-active" : "hover:bg-hover"
                    }`}
                  >
                    <IconFor group={item.group} selected={isSelected} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-fg">{item.label}</span>
                      {item.hint && (
                        <span className="mt-0.5 block truncate text-xs text-fg-muted">
                          {item.hint}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
          <span className="font-mono text-xs text-fg-muted/80">
            ↑↓ choose · ↵ run · tab trapped · esc close
          </span>
        </div>
      </div>
    </div>
  );
}

function IconFor(props: { group: string; selected: boolean }) {
  const className = `shrink-0 ${props.selected ? "text-accent" : "text-fg-muted"}`;
  if (props.group === "Conversations") return <MessageSquare size={12} className={className} />;
  return <Terminal size={12} className={className} />;
}
