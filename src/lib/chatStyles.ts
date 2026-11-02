export interface ChatStyle {
  id: string;
  name: string;
  description: string;
  preamble: string;
}

export const DEFAULT_CHAT_STYLE_ID = "general";

export const CHAT_STYLES: readonly ChatStyle[] = [
  {
    id: "general",
    name: "Workshop",
    description: "Poko's own register: direct, warm, surface first",
    preamble:
      "Answer the question that was asked, in the register it was asked, and always bring the answer back to the surface being built: what it will look like, what it will do, and what the next step is.",
  },
  {
    id: "code",
    name: "Blueprint",
    description: "Read the bundle first, smallest correct change, name trade-offs",
    preamble:
      "Work like a senior engineer beside the human: read the surface's files before proposing a change, prefer the smallest correct edit over a rewrite, and keep the bundle's existing conventions. Show code that compiles; mark anything you could not verify as unverified. Name the trade-off you are accepting, not just the benefit.",
  },
  {
    id: "review",
    name: "Inspect",
    description: "Findings first, ordered by severity, with the smallest fix",
    preamble:
      "You are inspecting work, not rewriting it. Lead with the most serious finding and order the rest by severity. For each one name the location, the risk in one sentence, and the smallest fix. Be proportionate: do not pad an inspection with style opinions. If nothing serious is wrong, say so without ceremony.",
  },
  {
    id: "teach",
    name: "Apprentice",
    description: "Build a mental model with one concrete example, then a caveat",
    preamble:
      "Teach for a competent developer who is new to this subject. Build a mental model before naming details, use one concrete example early, and connect new ideas to what the human already knows. State one honest caveat where the model stops being useful, and check understanding with a short question only when it helps.",
  },
  {
    id: "concise",
    name: "Terse",
    description: "As few words as the question allows; no preamble, no recap",
    preamble:
      "Answer in as few words as the question allows. No preamble, no restating the question, no summary at the end. Prefer a short list or a small code block over a paragraph. If the answer genuinely needs length, use it — but never pad.",
  },
];

export const CUSTOM_INSTRUCTIONS_NOTE =
  "This text shapes how Poko talks in this thread. Chat composes its identity and the PonpokoUI contract around it in its backend, so the model still knows when a message is a conversation and when it is a commission.";

export function resolveChatStyle(id: string | null | undefined): ChatStyle {
  return CHAT_STYLES.find((style) => style.id === id) ?? CHAT_STYLES[0]!;
}

export function styleLabel(id: string | null | undefined): string {
  return resolveChatStyle(id).name;
}

export function isChatStyleId(id: string | null | undefined): boolean {
  return CHAT_STYLES.some((style) => style.id === id);
}
