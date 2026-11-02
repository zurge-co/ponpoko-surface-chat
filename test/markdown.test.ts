const { describe, test, expect } = await import("bun:test");

const {
  isSafeHref,
  parseInline,
  parseMarkdown,
  blockText,
} = await import("../src/chat/markdown/index.ts");

describe("markdown — blocks", () => {
  test("headings, paragraphs, rules and quotes are recognised", () => {
    const blocks = parseMarkdown("# Title\n\nfirst line\nsecond line\n\n---\n\n> quoted\n> line");
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Title" });
    expect(blocks[1]).toEqual({ type: "paragraph", text: "first line\nsecond line" });
    expect(blocks[2]).toEqual({ type: "hr" });
    expect(blocks[3]?.type).toBe("blockquote");
    if (blocks[3]?.type === "blockquote") {
      expect(blocks[3].blocks[0]).toEqual({ type: "paragraph", text: "quoted\nline" });
    }
  });

  test("lists keep nesting and task state", () => {
    const blocks = parseMarkdown("- one\n  - nested\n- [x] done\n- [ ] todo");
    expect(blocks).toHaveLength(1);
    const list = blocks[0]!;
    expect(list.type).toBe("list");
    if (list.type !== "list") return;
    expect(list.items).toHaveLength(3);
    expect(list.items[0]!.text).toBe("one");
    expect(list.items[0]!.children[0]?.type).toBe("list");
    expect(list.items[1]!.checked).toBe(true);
    expect(list.items[2]!.checked).toBe(false);
  });

  test("ordered lists keep their start number", () => {
    const blocks = parseMarkdown("3. three\n4. four");
    const list = blocks[0]!;
    expect(list.type).toBe("list");
    if (list.type !== "list") return;
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(3);
    expect(list.items.map((item) => item.text)).toEqual(["three", "four"]);
  });

  test("tables parse alignment and escaped pipes", () => {
    const blocks = parseMarkdown(
      "| Name | Count | Note |\n| :--- | ---: | :---: |\n| a | 2 | x \\| y |",
    );
    const table = blocks[0]!;
    expect(table.type).toBe("table");
    if (table.type !== "table") return;
    expect(table.header).toEqual(["Name", "Count", "Note"]);
    expect(table.align).toEqual(["left", "right", "center"]);
    expect(table.rows).toEqual([["a", "2", "x | y"]]);
  });

  test("a closed fence is code with its language", () => {
    const blocks = parseMarkdown("```rust\nfn main() {}\n```");
    expect(blocks[0]).toEqual({
      type: "code",
      lang: "rust",
      code: "fn main() {}",
      closed: true,
    });
  });

  test("an unterminated fence is still code while streaming", () => {
    const blocks = parseMarkdown("here:\n```ts\nconst x = 1\n");
    expect(blocks[1]).toEqual({
      type: "code",
      lang: "ts",
      code: "const x = 1\n",
      closed: false,
    });
  });

  test("raw HTML is never markup — it stays a paragraph", () => {
    const blocks = parseMarkdown("<script>alert('x')</script>\n\n<div class=\"x\">hi</div>");
    expect(blocks.every((block) => block.type === "paragraph")).toBe(true);
    expect(blockText(blocks)).toContain("<script>");
    expect(blockText(blocks)).toContain("<div class=");
  });
});

describe("markdown — inline", () => {
  test("strong, emphasis, strike, code and links", () => {
    const nodes = parseInline("**bold** *em* ~~gone~~ `x` [Ponpoko](https://ponpoko.app)");
    const types = nodes.map((node) => node.type);
    expect(types).toContain("strong");
    expect(types).toContain("em");
    expect(types).toContain("del");
    expect(types).toContain("code");
    const link = nodes.find((node) => node.type === "link");
    expect(link && link.type === "link" ? link.href : "").toBe("https://ponpoko.app");
  });

  test("unsafe link schemes are demoted to text", () => {
    const nodes = parseInline("[click](javascript:alert(1))");
    expect(nodes.some((node) => node.type === "link")).toBe(false);
    expect(blockText([{ type: "paragraph", text: "" }])).toBe("");

    const text = nodes
      .map((node) => (node.type === "text" ? node.text : ""))
      .join("");
    expect(text).toBe("click");
  });

  test("safe hrefs are explicit", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("mailto:a@b.c")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    expect(isSafeHref("https://exa mple.com")).toBe(false);
  });

  test("autolinks and images", () => {
    const nodes = parseInline("<https://example.com> ![alt](https://example.com/a.png)");
    expect(nodes.some((node) => node.type === "link")).toBe(true);
    const image = nodes.find((node) => node.type === "link" && node.image);
    expect(image).toBeTruthy();
  });

  test("snake_case is not italicised", () => {
    const nodes = parseInline("use snake_case here");
    expect(nodes.every((node) => node.type === "text")).toBe(true);
  });

  test("unclosed emphasis is literal text", () => {
    const nodes = parseInline("**not closed");
    expect(nodes).toEqual([{ type: "text", text: "**not closed" }]);
  });
});
