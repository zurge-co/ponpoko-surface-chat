const { describe, test, expect } = await import("bun:test");

const {
  exportFileName,
  parseChatMeta,
  planEdit,
  planRetry,
  planRetryFromLastUser,
  transcriptMarkdown,
  transcriptTurns,
} = await import("../src/chat/history");

function row(overrides = {}) {
  return {
    message_id: 1,
    seq: 1,
    role: "user",
    content: "hello",
    meta_json: "",
    created_at: 1,
    ...overrides,
  };
}

const rows = [
  row({ message_id: 1, seq: 1, role: "user", content: "first question" }),
  row({ message_id: 2, seq: 2, role: "assistant", content: "first answer" }),
  row({ message_id: 3, seq: 3, role: "user", content: "second question" }),
  row({ message_id: 4, seq: 4, role: "assistant", content: "second answer" }),
];

describe("a message's meta is parsed only when it is the shape we wrote", () => {
  test("a known meta keeps the fields it understands", () => {
    const meta = parseChatMeta('{"provider_id":"openai","model":"gpt","elapsed_ms":12}');
    expect(meta?.provider_id).toBe("openai");
    expect(meta?.model).toBe("gpt");
    expect(meta?.elapsed_ms).toBe(12);
  });

  test("empty, broken and non-object meta is nothing, not a throw", () => {
    expect(parseChatMeta("")).toBeNull();
    expect(parseChatMeta("   ")).toBeNull();
    expect(parseChatMeta("not json")).toBeNull();
    expect(parseChatMeta("[1,2]")).toBeNull();
    expect(parseChatMeta(null)).toBeNull();
  });

  test("a field of the wrong type is dropped rather than trusted", () => {
    const meta = parseChatMeta('{"elapsed_ms":"soon","stopped":"yes","tool":"  "}');
    expect(meta?.elapsed_ms).toBeUndefined();
    expect(meta?.stopped).toBeUndefined();
    expect(meta?.tool).toBeUndefined();
  });
});

describe("the transcript the model is asked with drops what it never wrote", () => {
  test("system and tool rows are not conversation", () => {
    const turns = transcriptTurns([
      row({ message_id: 1, role: "system", content: "instructions" }),
      row({ message_id: 2, role: "tool", content: "result" }),
      row({ message_id: 3, role: "user", content: "hi" }),
    ]);
    expect(turns).toEqual([{ role: "user", content: "hi" }]);
  });

  test("a tool round of the assistant is not part of the conversation either", () => {
    const turns = transcriptTurns([
      row({ message_id: 1, role: "assistant", content: "calling", meta_json: '{"tool_round":true}' }),
      row({ message_id: 2, role: "assistant", content: "answered" }),
    ]);
    expect(turns.map((turn) => turn.content)).toEqual(["answered"]);
  });
});

describe("a retry keeps everything before the question it re-asks", () => {
  test("retrying an answer re-asks its own question", () => {
    const plan = planRetry(rows, 4);
    expect(plan?.keepSeq).toBe(3);
    expect(plan?.initialText).toBe("second question");
    expect(plan?.history.at(-1)).toEqual({ role: "user", content: "second question" });
  });

  test("a row that is not an answer has nothing to retry", () => {
    expect(planRetry(rows, 3)).toBeNull();
    expect(planRetry(rows, 999)).toBeNull();
  });

  test("an answer with no question before it has nothing to retry", () => {
    expect(planRetry([row({ message_id: 9, seq: 9, role: "assistant" })], 9)).toBeNull();
  });

  test("retrying the last turn finds the last question", () => {
    expect(planRetryFromLastUser(rows)?.initialText).toBe("second question");
    expect(planRetryFromLastUser([])).toBeNull();
  });

  test("editing a question keeps only what came before it", () => {
    const plan = planEdit(rows, 3);
    expect(plan?.keepSeq).toBe(2);
    expect(plan?.history).toEqual([
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
    ]);
  });

  test("only a user row can be edited", () => {
    expect(planEdit(rows, 4)).toBeNull();
    expect(planEdit(rows, 999)).toBeNull();
  });
});

describe("an export is a conversation a human can read", () => {
  test("the title becomes a heading, and an empty title has a fallback", () => {
    expect(transcriptMarkdown("A talk", rows).startsWith("# A talk\n\n")).toBe(true);
    expect(transcriptMarkdown("   ", rows).startsWith("# Conversation\n\n")).toBe(true);
  });

  test("each turn is labelled You or Assistant, and system rows are left out", () => {
    const markdown = transcriptMarkdown("t", [
      row({ message_id: 1, role: "system", content: "hidden" }),
      ...rows.slice(0, 2),
    ]);
    expect(markdown).toContain("## You\n\nfirst question");
    expect(markdown).toContain("## Assistant\n\nfirst answer");
    expect(markdown).not.toContain("hidden");
  });

  test("an empty turn is skipped rather than written as an empty heading", () => {
    const markdown = transcriptMarkdown("t", [row({ message_id: 1, content: "  " })]);
    expect(markdown).toBe("# t\n\n");
  });

  test("a file name is derived from the title and always ends in .md", () => {
    expect(exportFileName("A talk")).toBe("A talk.md");
    expect(exportFileName("a/b:c*d?e")).toBe("a-b-c-d-e.md");
    expect(exportFileName("   ")).toBe("conversation.md");
  });
});
