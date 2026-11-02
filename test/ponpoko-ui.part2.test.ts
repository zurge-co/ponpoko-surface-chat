const { describe, test, expect } = await import("bun:test");




describe("PonpokoUI — markdown integration", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Markdown } = await import("../src/chat/Markdown");

  test("a ponpoko-ui fence becomes a PonpokoUIBlock between the prose", () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        text: 'Before\n\n```ponpoko-ui\nroot = Card("Hi", [Text("body")])\n```\n\nAfter',
      }),
    );
    expect(html).toContain("data-ponpoko-ui-block");
    expect(html).toContain("Generated UI");
    expect(html).toContain("body");
    expect(html).toContain("Before");
    expect(html).toContain("After");
  });

  test("every other fence stays a code block", () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, { text: "```ts\nconst x = 1\n```" }),
    );
    expect(html).toContain("data-code-block");
    expect(html).not.toContain("data-ponpoko-ui-block");
  });

  test("a stored reply with another fence stays a code block", () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        text: '```ui\nroot = Card("Old", [Text("written with another name")])\n```',
      }),
    );
    expect(html).not.toContain("data-ponpoko-ui-block");
    expect(html).toContain("data-code-block");
  });
});
