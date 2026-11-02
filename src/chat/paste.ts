export const PASTE_IMAGE_SENTENCE =
  "The clipboard holds no image to paste — copy a screenshot or a picture first.";
export const PASTE_ADDED_SENTENCE = "Pasted image attached as context.";

export type PasteRoute = "text" | "image" | "nothing";

export function pasteRoute(clipboardTypes: readonly string[], hasText: boolean): PasteRoute {
  const types = clipboardTypes.map((type) => type.toLowerCase());
  if (types.some((type) => type.startsWith("image/"))) return "image";
  const carriesSomething = types.some((type) => type.length > 0);
  if (hasText || carriesSomething) return "text";
  return "nothing";
}

export function pasteRefusal(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error ?? "")).trim();
  return text.length > 0 ? text : PASTE_IMAGE_SENTENCE;
}
