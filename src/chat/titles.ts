const THREAD_TITLE_MAX = 48;

export function titleFrom(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= THREAD_TITLE_MAX) return oneLine;
  return `${oneLine.slice(0, THREAD_TITLE_MAX - 1)}…`;
}
