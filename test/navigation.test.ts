const { describe, test, expect } = await import("bun:test");

const {
  groupThreads,
  rankPalette,
  shortcutFor,
  threadBucket,
  wrapIndex,
  THREAD_GROUP_LABELS,
} = await import("../src/chat/navigation");

type Row = {
  thread_id: string;
  title: string;
  pinned: boolean;
  updated_at: number;
  style_id: string;
  provider_id: string | null;
};

function row(
  id: string,
  updatedAt: number,
  pinned = false,
  styleId = "general",
  providerId: string | null = null,
): Row {
  return {
    thread_id: id,
    title: id,
    pinned,
    updated_at: updatedAt,
    style_id: styleId,
    provider_id: providerId,
  };
}

const NOW = new Date(2026, 2, 10, 12, 0, 0).getTime();
const secs = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m, d, h, 0, 0).getTime() / 1000;

describe("rail grouping — date sections a human recognises", () => {
  test("uses local calendar days, not rolling 24-hour windows", () => {
    expect(threadBucket(secs(2026, 2, 10, 0), NOW)).toBe("today");
    expect(threadBucket(secs(2026, 2, 9, 23), NOW)).toBe("yesterday");
    expect(threadBucket(secs(2026, 2, 8, 12), NOW)).toBe("week");
    expect(threadBucket(secs(2026, 2, 3, 12), NOW)).toBe("week");
    expect(threadBucket(secs(2026, 2, 2, 12), NOW)).toBe("older");
  });

  test("sections come in order and empty ones are not drawn", () => {
    const groups = groupThreads(
      [
        row("today", secs(2026, 2, 10, 9)),
        row("yesterday", secs(2026, 2, 9, 9)),
        row("week", secs(2026, 2, 5, 9)),
        row("older", secs(2025, 11, 1)),
      ],
      NOW,
    );
    expect(groups.map((group) => group.key)).toEqual(["today", "yesterday", "week", "older"]);
    expect(groups.map((group) => group.label)).toEqual([
      THREAD_GROUP_LABELS.today,
      THREAD_GROUP_LABELS.yesterday,
      THREAD_GROUP_LABELS.week,
      THREAD_GROUP_LABELS.older,
    ]);

    const only = groupThreads([row("today", secs(2026, 2, 10, 9))], NOW);
    expect(only).toHaveLength(1);
    expect(only[0]!.key).toBe("today");
  });

  test("a pinned thread is lifted out and never listed twice", () => {
    const groups = groupThreads(
      [
        row("old-but-pinned", secs(2025, 11, 1), true),
        row("fresh", secs(2026, 2, 10, 9)),
      ],
      NOW,
    );
    expect(groups[0]!.key).toBe("pinned");
    expect(groups[0]!.threads.map((thread) => thread.thread_id)).toEqual(["old-but-pinned"]);
    const listed = groups.flatMap((group) => group.threads.map((thread) => thread.thread_id));
    expect(listed).toEqual(["old-but-pinned", "fresh"]);
    expect(groups.some((group) => group.key === "older")).toBe(false);
  });

  test("within a section the most recent conversation is first", () => {
    const groups = groupThreads(
      [
        row("morning", secs(2026, 2, 10, 8)),
        row("noon", secs(2026, 2, 10, 11)),
        row("pinned-old", secs(2026, 2, 10, 7), true),
        row("pinned-new", secs(2026, 2, 10, 10), true),
      ],
      NOW,
    );
    expect(groups[0]!.threads.map((thread) => thread.thread_id)).toEqual([
      "pinned-new",
      "pinned-old",
    ]);
    expect(groups[1]!.threads.map((thread) => thread.thread_id)).toEqual(["noon", "morning"]);
  });

  test("an empty rail is an empty list, not a section per label", () => {
    expect(groupThreads([], NOW)).toEqual([]);
  });
});

describe("shortcuts — one muscle memory, no surprises", () => {
  const base = { metaKey: true, ctrlKey: false, altKey: false };

  test("⌘N, ⌘K and ⌘B are the three navigation keys", () => {
    expect(shortcutFor({ ...base, key: "n" })).toBe("new-chat");
    expect(shortcutFor({ ...base, key: "k" })).toBe("command-palette");
    expect(shortcutFor({ ...base, key: "b" })).toBe("toggle-rail");
    expect(shortcutFor({ ...base, key: "/" })).toBeNull();
  });

  test("the same keys work with Ctrl", () => {
    expect(shortcutFor({ key: "K", metaKey: false, ctrlKey: true, altKey: false })).toBe(
      "command-palette",
    );
    expect(shortcutFor({ key: "K", metaKey: true, ctrlKey: false, altKey: false })).toBe(
      "command-palette",
    );
  });

  test("Shift is left to the native menu (⌘⇧N opens a new window)", () => {
    expect(
      shortcutFor({ key: "N", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true }),
    ).toBeNull();
  });

  test("a bare key, Alt combinations and other letters are left alone", () => {
    expect(shortcutFor({ key: "k", metaKey: false, ctrlKey: false, altKey: false })).toBeNull();
    expect(shortcutFor({ key: "k", metaKey: true, ctrlKey: false, altKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: "p" })).toBeNull();
    expect(shortcutFor({ ...base, key: "Escape" })).toBeNull();
  });
});

describe("palette ranking", () => {
  const items = [
    { id: "a", group: "Actions", label: "New conversation", keywords: "chat" },
    { id: "b", group: "Actions", label: "Export this conversation", hint: "markdown" },
    { id: "c", group: "Prompts", label: "Explain this file", keywords: "teach" },
    { id: "d", group: "Actions", label: "Toggle theme", hint: "dark or light" },
  ];

  test("an empty query keeps every row in its existing order", () => {
    expect(rankPalette(items, "  ").map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("prefix beats a word in the middle, which beats a keyword and a hint", () => {
    expect(rankPalette(items, "conversation").map((item) => item.id)).toEqual(["a", "b"]);
    expect(rankPalette(items, "this").map((item) => item.id)).toEqual(["b", "c"]);
    expect(rankPalette(items, "teach").map((item) => item.id)).toEqual(["c"]);
    expect(rankPalette(items, "light").map((item) => item.id)).toEqual(["d"]);
  });

  test("nothing matching is an empty list, not a fuzzy guess", () => {
    expect(rankPalette(items, "kubernetes")).toEqual([]);
  });
});

describe("selection movement", () => {
  test("wraps at both ends and never divides by zero", () => {
    expect(wrapIndex(0, 3, 1)).toBe(1);
    expect(wrapIndex(2, 3, 1)).toBe(0);
    expect(wrapIndex(0, 3, -1)).toBe(2);
    expect(wrapIndex(0, 0, 1)).toBe(0);
  });
});
