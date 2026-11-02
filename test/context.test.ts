const { describe, test, expect } = await import("bun:test");

const {
  CONTEXT_FENCE,
  CONTEXT_FILE_MAX_BYTES,
  CONTEXT_TOTAL_MAX_BYTES,
  IMAGE_FILE_MAX_BYTES,
  PDF_FILE_MAX_BYTES,
  contextBlocks,
  capFor,
  contextFileName,
  contextFilesOf,
  contextTotals,
  estimateTokens,
  fenceFor,
  formatBytes,
  parseContextInfo,
  planContextAttach,
  serializeContextBlock,
  splitContextFences,
  withContextBlocks,
} = await import("../src/chat/context");

type File = {
  name: string;
  path: string;
  bytes: number;
  kind: "text" | "image" | "pdf";
  content: string;
  mediaType?: string;
};

function file(name: string, content: string, path = `/work/${name}`): File {
  return { name, path, bytes: content.length, kind: "text", content };
}

function image(name: string, bytes: number, path = `/work/${name}`): File {
  return {
    name,
    path,
    bytes,
    kind: "image",
    content: "",
    mediaType: "image/png",
  };
}

function pdf(name: string, content: string, path = `/work/${name}`): File {
  return { name, path, bytes: content.length, kind: "pdf", content };
}

describe("the ponpoko-file block", () => {
  test("writes the path and the byte count into a fence the human can read", () => {
    const one = file("main.ts", "const answer = 42;\n");
    const block = serializeContextBlock(one);
    expect(block.startsWith(`\`\`\`ponpoko-file path=/work/main.ts bytes=${one.bytes}\n`)).toBe(true);
    expect(block.endsWith("```")).toBe(true);
    expect(block).toContain("const answer = 42;");
  });

  test("only the ponpoko-file fence is read back as an attachment", () => {
    const old = ["what broke?", "", "```file path=/work/main.ts bytes=5", "boom", "```"].join("\n");
    expect(splitContextFences(old).map((segment) => segment.kind)).toEqual(["prose"]);
  });

  test("survives a round trip — words, path, bytes and content all come back", () => {
    const files = [
      file("main.ts", "export const answer = 42;\n"),
      file("notes.md", "# Notes\n\n- a\n- b\n"),
    ];
    const message = withContextBlocks("read these and tell me what breaks", files);
    const segments = splitContextFences(message);

    expect(segments[0]!.kind).toBe("prose");
    expect(segments.filter((segment) => segment.kind === "file")).toHaveLength(2);
    const parsed = contextFilesOf(message);
    expect(parsed.map((entry) => entry.path)).toEqual(files.map((entry) => entry.path));
    expect(parsed.map((entry) => entry.content)).toEqual(files.map((entry) => entry.content));
    expect(parsed.map((entry) => entry.bytes)).toEqual(files.map((entry) => entry.bytes));
  });

  test("the human's own words stay first and unchanged", () => {
    const message = withContextBlocks("explain this", [file("a.ts", "x")]);
    expect(message.startsWith("explain this\n\n")).toBe(true);
    expect(splitContextFences(message)[0]).toEqual({ kind: "prose", text: "explain this\n" });
  });

  test("a file full of backticks cannot close the block early", () => {
    const markdown = "before\n```ts\nconst x = 1;\n```\nafter\n";
    const one = file("README.md", markdown);
    const block = serializeContextBlock(one);
    expect(fenceFor(markdown)).toBe("````");
    expect(block.startsWith("````ponpoko-file")).toBe(true);

    const parsed = contextFilesOf(withContextBlocks("look", [one]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.content).toBe(markdown);
  });

  test("a path with spaces or quotes is preserved exactly", () => {
    const one = file("my file.ts", "x", '/work/a "quoted"/my file.ts');
    const parsed = contextFilesOf(withContextBlocks("hi", [one]));
    expect(parsed[0]!.path).toBe('/work/a "quoted"/my file.ts');
    expect(parseContextInfo(`${CONTEXT_FENCE} path="/work/dir with space/a.ts" bytes=3`)).toEqual({
      kind: "text",
      path: "/work/dir with space/a.ts",
      bytes: 3,
    });
  });

  test("no files means no block at all", () => {
    expect(withContextBlocks("just words", [])).toBe("just words");
    expect(contextBlocks([])).toBe("");
  });

  test("the info line is recognised only for a known file fence", () => {
    expect(parseContextInfo("ts path=/a bytes=1")).toBeNull();
    expect(parseContextInfo(`${CONTEXT_FENCE} bytes=1`)).toBeNull();
    expect(parseContextInfo(`${CONTEXT_FENCE} path=/a.ts`)).toEqual({
      kind: "text",
      path: "/a.ts",
      bytes: 0,
    });
    expect(parseContextInfo("file path=/a.ts")).toBeNull();
  });
});

describe("the renderer's decision", () => {
  test("an attachment becomes a card segment, not prose to dump", () => {
    const message = withContextBlocks("what is wrong here?", [file("bug.ts", "boom\n")]);
    const segments = splitContextFences(message);
    const files = segments.filter((segment) => segment.kind === "file");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      kind: "file",
      complete: true,
      file: { name: "bug.ts", content: "boom\n" },
    });
    const prose = segments
      .filter((segment) => segment.kind === "prose")
      .map((segment) => (segment.kind === "prose" ? segment.text : ""))
      .join("");
    expect(prose).not.toContain(CONTEXT_FENCE);
  });

  test("an example inside a code fence is quoted prose, not an attachment", () => {
    const reply =
      "Attachments look like this:\n\n```md\n```ponpoko-file path=/tmp/a.ts bytes=1\nx\n```\n```\n\nThat is all.";
    const segments = splitContextFences(reply);
    expect(segments.every((segment) => segment.kind === "prose")).toBe(true);
  });

  test("every other fence stays where it was", () => {
    const text = "```ts\nconst a = 1;\n```\n";
    const segments = splitContextFences(text);
    expect(segments).toEqual([{ kind: "prose", text }]);
  });

  test("an unclosed block is shown, marked cut short, instead of hidden", () => {
    const text = "```ponpoko-file path=/tmp/a.ts bytes=99\nstill arriving";
    const segments = splitContextFences(text);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "file", complete: false });
  });

  test("a file name is read from the path without touching the disk", () => {
    expect(contextFileName("/a/b/c/main.ts")).toBe("main.ts");
    expect(contextFileName("C:\\work\\main.ts")).toBe("main.ts");
    expect(contextFileName("/")).toBe("/");
  });
});

describe("caps — refuse with a sentence, never truncate silently", () => {
  test("a file over 256 KiB is refused and nothing is attached", () => {
    const tooBig = file("huge.log", "x".repeat(CONTEXT_FILE_MAX_BYTES + 1));
    const plan = planContextAttach([], [tooBig]);
    expect(plan.files).toEqual([]);
    expect(plan.added).toEqual([]);
    expect(plan.refused).toHaveLength(1);
    expect(plan.refused[0]).toContain("huge.log");
    expect(plan.refused[0]).toContain("256 KiB");
  });

  test("the total is capped at 8 MiB across the turn", () => {
    const parts = Array.from({ length: 5 }, (_, i) =>
      image(`p${i}.png`, 2 * 1024 * 1024, `/work/p${i}.png`),
    );
    const plan = planContextAttach([], parts);
    expect(plan.added.map((entry) => entry.name)).toEqual([
      "p0.png",
      "p1.png",
      "p2.png",
      "p3.png",
    ]);
    expect(plan.refused).toHaveLength(1);
    expect(plan.refused[0]).toContain("p4.png");
    expect(plan.refused[0]).toContain("8.0 MiB");
  });

  test("attaching the same file twice is refused, not duplicated", () => {
    const one = file("a.ts", "x");
    const plan = planContextAttach([one], [one]);
    expect(plan.files).toEqual([one]);
    expect(plan.refused[0]).toContain("already attached");
  });

  test("an already-full context refuses everything that would grow it", () => {
    const full = file("a.bin", "a".repeat(CONTEXT_TOTAL_MAX_BYTES));
    const plan = planContextAttach([full], [file("b.ts", "b")]);
    expect(plan.files).toEqual([full]);
    expect(plan.refused).toHaveLength(1);
  });
});

describe("sizes are stated honestly", () => {
  test("bytes read the way a human does", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KiB");
    expect(formatBytes(12 * 1024)).toBe("12 KiB");
    expect(formatBytes(CONTEXT_FILE_MAX_BYTES)).toBe("256 KiB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MiB");
    expect(formatBytes(-5)).toBe("0 B");
  });

  test("the token estimate says it is rough and never lies about zero", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(400)).toBe(100);
    expect(estimateTokens(401)).toBe(101);
  });

  test("totals add up across the attachments", () => {
    const totals = contextTotals([file("a.ts", "1234"), file("b.ts", "56")]);
    expect(totals).toEqual({ bytes: 6, chars: 6, tokens: 2 });
  });
});

describe("an image and a PDF are attachments of their own kind", () => {
  test("an image fence round-trips its path, bytes and media type with no body", () => {
    const one = image("shot.png", 4096);
    const message = withContextBlocks("what is in this picture?", [one]);
    expect(message).toContain("```ponpoko-image path=/work/shot.png bytes=4096 media=image/png");
    const parsed = contextFilesOf(message);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      kind: "image",
      path: "/work/shot.png",
      bytes: 4096,
      mediaType: "image/png",
      content: "",
    });
    const segment = splitContextFences(message).find((entry) => entry.kind === "file");
    expect(segment).toMatchObject({ complete: true });
  });

  test("a PDF fence round-trips the text layer it carries", () => {
    const one = pdf("letter.pdf", "Hello from a PDF\nsecond line\n");
    const parsed = contextFilesOf(withContextBlocks("summarise this", [one]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.kind).toBe("pdf");
    expect(parsed[0]!.content).toBe("Hello from a PDF\nsecond line\n");
    expect(parsed[0]!.bytes).toBe(one.content.length);
  });

  test("an image fence printed inside a fenced example stays prose", () => {
    const reply = [
      "Attachments look like this:",
      "",
      "```md",
      "```ponpoko-image path=/tmp/a.png bytes=10 media=image/png",
      "```",
      "```",
      "",
      "That is all.",
    ].join("\n");
    expect(splitContextFences(reply).every((segment) => segment.kind === "prose")).toBe(true);
  });

  test("a text fence still reads as text, and only the right name opens a block", () => {
    const parsed = contextFilesOf(withContextBlocks("look", [file("a.ts", "const a = 1;\n")]));
    expect(parsed[0]!.kind).toBe("text");
    expect(parsed[0]!.content).toBe("const a = 1;\n");
    expect(parseContextInfo("ponpoko-image bytes=1")).toBeNull();
    expect(parseContextInfo("ponpoko-imagepath=/a.png bytes=1")).toBeNull();
    expect(parseContextInfo("ponpoko-pdf path=/a.pdf bytes=2")).toEqual({
      kind: "pdf",
      path: "/a.pdf",
      bytes: 2,
    });
  });

  test("every kind is mixed in one message without swallowing the others", () => {
    const one = file("a.ts", "x\n");
    const picture = image("b.png", 2048);
    const document = pdf("c.pdf", "page text\n");
    const parsed = contextFilesOf(withContextBlocks("read all three", [one, picture, document]));
    expect(parsed.map((entry) => entry.kind)).toEqual(["text", "image", "pdf"]);
    expect(parsed.map((entry) => entry.path)).toEqual([
      "/work/a.ts",
      "/work/b.png",
      "/work/c.pdf",
    ]);
  });
});

describe("the per-kind caps refuse by name and never truncate", () => {
  test("an image past 5 MiB is refused and one exactly at it is accepted", () => {
    const atCap = planContextAttach([], [image("at-cap.png", IMAGE_FILE_MAX_BYTES)]);
    expect(atCap.added.map((entry) => entry.name)).toEqual(["at-cap.png"]);

    const past = planContextAttach([], [image("past-cap.png", IMAGE_FILE_MAX_BYTES + 1)]);
    expect(past.files).toEqual([]);
    expect(past.refused).toHaveLength(1);
    expect(past.refused[0]).toContain("past-cap.png");
    expect(past.refused[0]).toContain("5.0 MiB");
  });

  test("a PDF past 8 MiB is refused by name", () => {
    const plan = planContextAttach([], [pdf("huge.pdf", "p".repeat(PDF_FILE_MAX_BYTES + 1))]);
    expect(plan.files).toEqual([]);
    expect(plan.refused[0]).toContain("huge.pdf");
    expect(plan.refused[0]).toContain("8.0 MiB");
  });

  test("the cap that applies is the one of that file's own kind", () => {
    expect(capFor("text")).toBe(CONTEXT_FILE_MAX_BYTES);
    expect(capFor("image")).toBe(IMAGE_FILE_MAX_BYTES);
    expect(capFor("pdf")).toBe(PDF_FILE_MAX_BYTES);
    const plan = planContextAttach([], [file("ok.ts", "x".repeat(CONTEXT_FILE_MAX_BYTES + 1))]);
    expect(plan.refused[0]).toContain("256 KiB");
  });
});
