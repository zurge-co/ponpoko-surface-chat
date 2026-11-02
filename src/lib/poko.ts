export const POKO_NAME = "Poko";

export const POKO_SPECIES = "tanuki";

export const POKO_ROOT = "Ponpoko";

export const POKO_ROLE =
  "the tanuki who lives in Ponpoko and builds the surfaces you work in";

export const POKO_GREETING_SETUP =
  "Hello, I'm Poko — the tanuki who lives in Ponpoko. I don't chat for the sake of chatting: you tell me what a screen should do, and I design it, build it, install it as a surface, then keep tuning it while you use it. I need a model to think with before we start, so pick one right here and I'll take it from there.";

export const POKO_GREETING_READY =
  "Hello again — Poko here. The kettle's on and my paws are free. Tell me what we're building today, or what the surface you're in should do better.";

export const POKO_GREETING_NEUTRAL =
  "Hello — Poko here, the tanuki who builds the surfaces you work in. Tell me what a screen should do and I'll take it from there.";

export const POKO_SETUP_TITLE = "Set up the model I think with";

export const POKO_SETUP_NOTE =
  "One provider, one key, one model. It is stored by Ponpoko on this machine and never leaves it except to reach the provider you pick.";

export const POKO_SETUP_DONE = "Ready. Ask me for a surface.";

export const POKO_TOOL_HEADLINE = "Paws in the workshop, building your surface";

export type PokoReadiness = boolean | null;

export function pokoGreeting(readiness: PokoReadiness): string {
  if (readiness === null) return POKO_GREETING_NEUTRAL;
  return readiness ? POKO_GREETING_READY : POKO_GREETING_SETUP;
}

export function pokoNeedsSetup(readiness: PokoReadiness): boolean {
  return readiness === false;
}

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|[\u{FE0F}\u{200D}]/u;

export function hasEmoji(text: string): boolean {
  return EMOJI.test(text);
}
