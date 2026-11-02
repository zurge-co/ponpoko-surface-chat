import type { PaletteAction } from "./CommandPalette";

export function buildPaletteActions(input: {
  newThread: () => void;
  openThreadSettings: () => void;
  exportThread: () => void;
  openPalette: () => void;
}): PaletteAction[] {
  return [
    {
      id: "new-chat",
      label: "New conversation",
      hint: "⌘N — start a fresh thread",
      keywords: "new chat thread",
      run: input.newThread,
    },
    {
      id: "thread-settings",
      label: "Thread settings",
      hint: "Style, model and custom instructions for this conversation",
      keywords: "style model system instructions",
      run: input.openThreadSettings,
    },
    {
      id: "export",
      label: "Export this conversation",
      hint: "Markdown, to a file you choose",
      keywords: "download save markdown",
      run: input.exportThread,
    },
    {
      id: "appearance",
      label: "Palette",
      hint: "Choose Ponpoko Light, Ponpoko Dark, or your own palette",
      keywords: "dark light appearance color palette",
      run: input.openPalette,
    },
  ];
}
