export interface RailThread {
  thread_id: string;
  title: string;
  pinned: boolean;
  updated_at: number;
  style_id: string;
  provider_id: string | null;
}

export type ThreadGroupKey = "pinned" | "today" | "yesterday" | "week" | "older";

export interface ThreadGroup<T extends RailThread = RailThread> {
  key: ThreadGroupKey;
  label: string;
  threads: T[];
}

export const THREAD_GROUP_LABELS: Record<ThreadGroupKey, string> = {
  pinned: "Pinned",
  today: "Today",
  yesterday: "Yesterday",
  week: "Previous 7 days",
  older: "Older",
};

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysBack(todayStart: number, days: number): number {
  const date = new Date(todayStart);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

export function threadBucket(updatedAtSeconds: number, nowMs = Date.now()): ThreadGroupKey {
  const updatedMs = updatedAtSeconds * 1000;
  const todayStart = startOfDay(nowMs);
  const yesterdayStart = daysBack(todayStart, 1);
  if (updatedMs >= todayStart) return "today";
  if (updatedMs >= yesterdayStart) return "yesterday";
  if (updatedMs >= daysBack(todayStart, 7)) return "week";
  return "older";
}

export function groupThreads<T extends RailThread>(
  threads: readonly T[],
  nowMs = Date.now(),
): ThreadGroup<T>[] {
  const pinned: T[] = [];
  const buckets: Record<Exclude<ThreadGroupKey, "pinned">, T[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const thread of threads) {
    if (thread.pinned) {
      pinned.push(thread);
      continue;
    }
    const bucket = threadBucket(thread.updated_at, nowMs);
    if (bucket !== "pinned") buckets[bucket].push(thread);
  }

  const byRecency = (a: T, b: T) => b.updated_at - a.updated_at;
  pinned.sort(byRecency);
  for (const list of Object.values(buckets)) list.sort(byRecency);

  const groups: ThreadGroup<T>[] = [];
  if (pinned.length) {
    groups.push({ key: "pinned", label: THREAD_GROUP_LABELS.pinned, threads: pinned });
  }
  for (const key of ["today", "yesterday", "week", "older"] as const) {
    if (buckets[key].length) {
      groups.push({ key, label: THREAD_GROUP_LABELS[key], threads: buckets[key] });
    }
  }
  return groups;
}

export interface ShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
}

export type ShortcutAction = "new-chat" | "command-palette" | "toggle-rail";

export function shortcutFor(event: ShortcutEvent): ShortcutAction | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  if (event.shiftKey) return event.key.toLowerCase() === "p" ? "command-palette" : null;
  switch (event.key.toLowerCase()) {
    case "n":
      return "new-chat";
    case "b":
      return "toggle-rail";
    default:
      return null;
  }
}

export interface PaletteCandidate {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
}

function scoreOf(candidate: PaletteCandidate, needle: string): number {
  const label = candidate.label.toLowerCase();
  if (label.startsWith(needle)) return 0;
  if (label.includes(needle)) return 1;
  if ((candidate.keywords ?? "").toLowerCase().includes(needle)) return 2;
  if ((candidate.hint ?? "").toLowerCase().includes(needle)) return 3;
  return -1;
}

export function rankPalette<T extends PaletteCandidate>(
  items: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const score = scoreOf(item, needle);
    if (score >= 0) scored.push({ item, score, index });
  });
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  return scored.map((entry) => entry.item);
}

export function wrapIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  const next = (current + delta) % length;
  return next < 0 ? next + length : next;
}
