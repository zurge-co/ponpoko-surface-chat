import { create } from "zustand";

interface ChatState {
  threadId: string | null;
  draft: string;
  setThread: (threadId: string | null) => void;
  setDraft: (draft: string | ((current: string) => string)) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  threadId: null,
  draft: "",
  setThread: (threadId) => set({ threadId }),
  setDraft: (draft) =>
    set((state) => ({ draft: typeof draft === "function" ? draft(state.draft) : draft })),
}));
