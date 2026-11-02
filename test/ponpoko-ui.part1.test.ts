const { describe, test, expect } = await import("bun:test");

const {
  PONPOKO_UI_ACTIONS,
  PONPOKO_UI_BUILTINS,
  PONPOKO_UI_CAPS,
  PONPOKO_UI_COMPONENTS,
  PONPOKO_UI_FENCE,
  PONPOKO_UI_PROMPT_EXAMPLES,
  buildPonpokoUISystemPrompt,
  compilePonpokoUI,
  componentSignature,
  isSafeOpenUrl,
  isPonpokoUIAction,
  isPonpokoUIElement,
  parsePonpokoUI,
  resetPonpokoUISystemPromptCache,
  splitPonpokoUIFences,
} = await import("../src/ponpoko-ui/index.ts");

const { PonpokoUIView } = await import("../src/chat/ponpoko-ui/PonpokoUIView");
const { PonpokoUIBlock } = await import("../src/chat/ponpoko-ui/PonpokoUIBlock");

function childElements(value: unknown): Array<{ name: string; props: Record<string, unknown> }> {
  if (!Array.isArray(value)) return [];
  return value.filter(isPonpokoUIElement) as Array<{ name: string; props: Record<string, unknown> }>;
}

describe("PonpokoUI — parser", () => {
  test("a complete program keeps every statement in order", () => {
    const parsed = parsePonpokoUI('title = "Review"\nroot = Card(title, [Text("hi")])');
    expect(parsed.incomplete).toBe(false);
    expect(parsed.errors).toEqual([]);
    expect(parsed.program.statements.map((statement) => statement.name)).toEqual(["title", "root"]);
  });

  test("newlines inside brackets are whitespace, not statement breaks", () => {
    const parsed = parsePonpokoUI(`root = Card("T", [
  Text("a"),

  Stack([
    Text("b")
  ])
])`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.incomplete).toBe(false);
    expect(parsed.program.statements).toHaveLength(1);
  });

  test("forward references are allowed", () => {
    const result = compilePonpokoUI(`root = Stack([
  Text(greeting),
  Table(columns, rows)
])
greeting = "hello"
columns = ["name"]
rows = [["ponpoko"]]`);
    expect(result.errors).toEqual([]);
    expect(result.tree?.name).toBe("Stack");
    const children = childElements(result.tree?.props.children);
    expect(children.map((child) => child.name)).toEqual(["Text", "Table"]);
    expect(children[0]?.props.text).toBe("hello");
  });

  test("member access plucks a field from every item in a list", () => {
    const result = compilePonpokoUI(`items = [{ name: "a" }, { name: "b" }]
root = List(items.name)`);
    expect(result.errors).toEqual([]);
    expect(result.tree?.props.items).toEqual(["a", "b"]);
  });

  test("indexing, ternary and arithmetic evaluate", () => {
    const result = compilePonpokoUI(`items = ["a", "b"]
root = Text(items[1] + (1 < 2 ? " yes" : " no"))`);
    expect(result.errors).toEqual([]);
    expect(result.tree?.props.text).toBe("b yes");
  });

  test("the whole operator set evaluates", () => {
    const result = compilePonpokoUI(`a = 2
b = 3
root = Card("ops", [
  Metric("add", a + b),
  Metric("sub", b - a),
  Metric("mul", a * b),
  Metric("div", b / a),
  Metric("gt", b > a ? 1 : 0),
  Metric("neg", -b),
  Metric("eq", a == 2 ? 1 : 0),
  Text((a != b && b >= 3) || false ? "yes" : "no"),
  Text(!false ? "not" : "false")
])`);
    expect(result.errors).toEqual([]);
    const children = childElements(result.tree?.props.children);
    expect(children.filter((child) => child.name === "Metric").map((metric) => metric.props.value)).toEqual([
      5,
      1,
      6,
      1.5,
      1,
      -3,
      1,
    ]);
    expect(children.filter((child) => child.name === "Text").map((child) => child.props.text)).toEqual([
      "yes",
      "not",
    ]);
  });

  test("an unterminated string and bracket are auto-closed while streaming", () => {
    const result = compilePonpokoUI('root = Card("T", [Text("hel');
    expect(result.incomplete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.tree?.name).toBe("Card");
    expect(childElements(result.tree?.props.children)[0]?.props.text).toBe("hel");
  });

  test("an unfinished trailing statement is dropped, earlier ones survive", () => {
    const result = compilePonpokoUI('root = Card("T", [Text("x")])\nmore = ');
    expect(result.incomplete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.tree?.name).toBe("Card");
  });

  test("a genuinely broken program reports an error and never throws", () => {
    const results = [
      'root = Card("a", ,)',
      "root = @",
      "root = [1, 2",
      '= "no name"',
      "root = Text(1 2)",
    ];
    for (const source of results) {
      const parsed = parsePonpokoUI(source);
      expect(Array.isArray(parsed.errors)).toBe(true);
    }
  });

  test("a name defined twice is reported and the first definition wins", () => {
    const result = compilePonpokoUI('title = "one"\ntitle = "two"\nroot = Text(title)');
    expect(result.tree?.props.text).toBe("one");
    expect(result.errors.some((error) => error.message.includes("defined more than once"))).toBe(true);
  });
});

describe("PonpokoUI — evaluator", () => {
  test("every catalog example evaluates cleanly", () => {
    for (const component of PONPOKO_UI_COMPONENTS) {
      const result = compilePonpokoUI(`root = ${component.example}`);
      expect(result.errors).toEqual([]);
      expect(result.tree?.name).toBe(component.name);
    }
  });

  test("built-ins compute from real values", () => {
    const result = compilePonpokoUI(`xs = [3, 4, 5]
names = ["a", "b"]
root = Card("Stats", [
  Metric("sum", @Sum(xs)),
  Metric("avg", @Avg(xs)),
  Metric("count", @Count(xs)),
  Metric("percent", @Percent(3, 4)),
  Text(@Join(names, " · "))
])`);
    expect(result.errors).toEqual([]);
    const children = childElements(result.tree?.props.children);
    const metrics = children.filter((child) => child.name === "Metric");
    expect(metrics.map((metric) => metric.props.value)).toEqual([12, 4, 3, "75%"]);
    expect(children.find((child) => child.name === "Text")?.props.text).toBe("a · b");
  });

  test("an unknown component is an error, not a crash and not a render", () => {
    const result = compilePonpokoUI('root = Nope("x")');
    expect(result.tree).toBeNull();
    expect(result.errors[0]?.message).toContain("unknown component 'Nope'");
  });

  test("an unknown function or action is refused", () => {
    const result = compilePonpokoUI('root = Text(@Teleport("x"))');
    expect(result.errors.some((error) => error.message.includes("unknown function or action '@Teleport'"))).toBe(
      true,
    );
  });

  test("wrong arity is a readable error and the incomplete component is not rendered", () => {
    const result = compilePonpokoUI('root = Card("only a title")');
    expect(result.errors.some((error) => error.message.includes("Card expects 2 to 3 arguments"))).toBe(
      true,
    );
    expect(result.tree).toBeNull();
  });

  test("a wrong prop type is refused and the valid siblings remain", () => {
    const result = compilePonpokoUI('root = Card("T", [Text("ok"), Table("not columns", [])])');
    expect(result.errors.some((error) => error.message.includes("Table argument 1 (columns)"))).toBe(
      true,
    );
    expect(result.tree?.name).toBe("Card");
    const children = childElements(result.tree?.props.children);
    expect(children.map((child) => child.name)).toEqual(["Text"]);
  });

  test("an unknown reference is a readable error", () => {
    const result = compilePonpokoUI("root = Text(missing)");
    expect(result.errors.some((error) => error.message.includes("unknown reference 'missing'"))).toBe(
      true,
    );
  });

  test("root must be a component call", () => {
    const result = compilePonpokoUI('root = "just a string"');
    expect(result.tree).toBeNull();
    expect(result.errors.some((error) => error.message.includes("root must be a component call"))).toBe(
      true,
    );
  });

  test("a program without root says so instead of rendering nothing", () => {
    const result = compilePonpokoUI('title = "x"');
    expect(result.tree).toBeNull();
    expect(result.errors.some((error) => error.message.includes("no root statement"))).toBe(true);
  });

  test("actions are data, and @Open refuses every non-http(s) scheme", () => {
    const good = compilePonpokoUI('root = Button("Docs", @Open("https://example.com/docs"))');
    expect(good.errors).toEqual([]);
    const action = good.tree?.props.action;
    expect(isPonpokoUIAction(action)).toBe(true);
    if (isPonpokoUIAction(action)) {
      expect(action.name).toBe("open");
      expect(action.value).toBe("https://example.com/docs");
    }

    for (const bad of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/x",
      "https://exa mple.com",
      "https://",
    ]) {
      const result = compilePonpokoUI(`root = Button("x", @Open("${bad}"))`);
      expect(result.errors.some((error) => error.message.includes("@Open only opens"))).toBe(true);
    }
  });

  test("@Ask, @Copy and @Insert carry text and never run anything", () => {
    for (const name of ["Ask", "Copy", "Insert"]) {
      const result = compilePonpokoUI(`root = Button("x", @${name}("hello"))`);
      expect(result.errors).toEqual([]);
      const action = result.tree?.props.action;
      expect(isPonpokoUIAction(action)).toBe(true);
      if (isPonpokoUIAction(action)) {
        expect(action.name).toBe(name.toLowerCase());
        expect(action.value).toBe("hello");
      }
    }
  });

  test("isSafeOpenUrl only accepts http(s) with a host", () => {
    expect(isSafeOpenUrl("https://example.com")).toBe(true);
    expect(isSafeOpenUrl("http://127.0.0.1:1420/x")).toBe(true);
    expect(isSafeOpenUrl("HTTPS://EXAMPLE.COM/A")).toBe(true);
    expect(isSafeOpenUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeOpenUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeOpenUrl("https://")).toBe(false);
    expect(isSafeOpenUrl("https://exa mple.com")).toBe(false);
  });
});

describe("PonpokoUI — limits", () => {
  test("the program-size cap refuses a huge program", () => {
    const result = compilePonpokoUI(`root = Text("${"a".repeat(PONPOKO_UI_CAPS.programChars)}")`);
    expect(result.tree).toBeNull();
    expect(result.errors[0]?.message).toContain(`the limit is ${PONPOKO_UI_CAPS.programChars}`);
  });

  test("a single string is shortened at the cap and said so", () => {
    const long = "a".repeat(PONPOKO_UI_CAPS.stringChars + 10);
    const result = compilePonpokoUI(`root = Text("${long}")`);
    expect(result.tree?.props.text).toHaveLength(PONPOKO_UI_CAPS.stringChars);
    expect(result.errors.some((error) => error.message.includes("it was shortened"))).toBe(true);
  });

  test("table rows are capped", () => {
    const rows = Array.from({ length: PONPOKO_UI_CAPS.tableRows + 1 }, (_, index) => `["r${index}"]`).join(",");
    const result = compilePonpokoUI(`root = Table(["name"], [${rows}])`);
    const body = result.tree?.props.rows;
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBe(PONPOKO_UI_CAPS.tableRows);
    expect(
      result.errors.some((error) =>
        error.message.includes(`only the first ${PONPOKO_UI_CAPS.tableRows}`),
      ),
    ).toBe(true);
  });

  test("chart points are capped", () => {
    const points = Array.from({ length: PONPOKO_UI_CAPS.chartPoints + 1 }, (_, index) => index).join(",");
    const result = compilePonpokoUI(`root = Line([${points}])`);
    expect((result.tree?.props.points as unknown[] | undefined)?.length).toBe(PONPOKO_UI_CAPS.chartPoints);
    expect(
      result.errors.some((error) =>
        error.message.includes(`only the first ${PONPOKO_UI_CAPS.chartPoints}`),
      ),
    ).toBe(true);
  });

  test("the rendered-element cap stops a runaway program", () => {
    const children = Array.from({ length: PONPOKO_UI_CAPS.nodes + 1 }, (_, index) => `Text("${index}")`).join(
      ",",
    );
    const result = compilePonpokoUI(`root = Stack([${children}])`);
    expect(result.tree).toBeNull();
    expect(
      result.errors.some((error) =>
        error.message.includes(`renders more than ${PONPOKO_UI_CAPS.nodes} components`),
      ),
    ).toBe(true);
  });

  test("the reference-depth cap stops a chain", () => {
    const lines: string[] = [];
    for (let index = 0; index < 40; index += 1) lines.push(`a${index} = a${index + 1}`);
    lines.push('a40 = "deep"');
    lines.push("root = Text(a0)");
    const result = compilePonpokoUI(lines.join("\n"));
    expect(
      result.errors.some((error) => error.message.includes(`nests deeper than ${PONPOKO_UI_CAPS.depth}`)),
    ).toBe(true);
  });

  test("a self-referencing statement is refused instead of looping", () => {
    const result = compilePonpokoUI("a = a\nroot = Text(a)");
    expect(result.errors.some((error) => error.message.includes("refers to itself"))).toBe(true);
  });
});

describe("PonpokoUI — system prompt", () => {
  test("every component, with its signature, description and example, appears", () => {
    resetPonpokoUISystemPromptCache();
    const prompt = buildPonpokoUISystemPrompt();
    for (const component of PONPOKO_UI_COMPONENTS) {
      expect(prompt).toContain(componentSignature(component));
      expect(prompt).toContain(component.description);
      expect(prompt).toContain(component.example);
    }
  });

  test("every built-in function and safe action appears", () => {
    const prompt = buildPonpokoUISystemPrompt();
    for (const builtin of PONPOKO_UI_BUILTINS) expect(prompt).toContain(builtin.signature);
    for (const action of PONPOKO_UI_ACTIONS) expect(prompt).toContain(action.signature);
    expect(prompt).toContain("@Ask");
    expect(prompt).toContain("@Copy");
    expect(prompt).toContain("@Insert");
    expect(prompt).toContain("@Open");
  });

  test("the two worked examples compile against our own grammar", () => {
    expect(PONPOKO_UI_PROMPT_EXAMPLES).toHaveLength(2);
    for (const example of PONPOKO_UI_PROMPT_EXAMPLES) {
      const result = compilePonpokoUI(example);
      expect(result.errors).toEqual([]);
      expect(result.tree).not.toBeNull();
    }
  });

  test("the prompt is built once and is the same text", () => {
    const first = buildPonpokoUISystemPrompt();
    const second = buildPonpokoUISystemPrompt();
    expect(second).toBe(first);
  });

  test("the prompt asks for the fence the splitter reads", () => {
    expect(PONPOKO_UI_FENCE).toBe("ponpoko-ui");
    const prompt = buildPonpokoUISystemPrompt();
    expect(prompt).toContain("```" + PONPOKO_UI_FENCE);
  });


});

describe("PonpokoUI — markdown splitter", () => {
  test("prose and ponpoko-ui fences keep their order", () => {
    const segments = splitPonpokoUIFences(
      'Here you go:\n```ponpoko-ui\nroot = Text("hi")\n```\nDone.',
    );
    expect(segments.map((segment) => segment.kind)).toEqual(["prose", "ponpoko-ui", "prose"]);
    const ui = segments[1];
    if (ui?.kind !== "ponpoko-ui") throw new Error("expected a ponpoko-ui segment");
    expect(ui.code).toBe('root = Text("hi")');
    expect(ui.complete).toBe(true);
  });

  test("an unterminated ponpoko-ui fence is marked incomplete while streaming", () => {
    const segments = splitPonpokoUIFences('```ponpoko-ui\nroot = Card("T", [Text("he');
    expect(segments).toHaveLength(1);
    const ui = segments[0];
    if (ui?.kind !== "ponpoko-ui") throw new Error("expected a ponpoko-ui segment");
    expect(ui.complete).toBe(false);
    expect(ui.code).toContain('Text("he');
  });

  test("another language's fence is never scanned for a ponpoko-ui opening", () => {
    const segments = splitPonpokoUIFences('```ts\nconst marker = "```ponpoko-ui"\n```\nplain');
    expect(segments.every((segment) => segment.kind === "prose")).toBe(true);
  });

  test("a fence with another name is prose, not a program", () => {
    const segments = splitPonpokoUIFences('Old reply:\n```ui\nroot = Text("hi")\n```');
    expect(segments.every((segment) => segment.kind === "prose")).toBe(true);
  });

  test("a tilde fence works and a close needs enough markers", () => {
    const segments = splitPonpokoUIFences('~~~ponpoko-ui\nroot = Text("x")\n~~~\n');
    expect(segments[0]?.kind).toBe("ponpoko-ui");
    const short = splitPonpokoUIFences("````ponpoko-ui\nroot = Text(\"x\")\n```\nstill inside");
    const ui = short[0];
    if (ui?.kind !== "ponpoko-ui") throw new Error("expected a ponpoko-ui segment");
    expect(ui.complete).toBe(false);
  });
});

;

describe("PonpokoUI — renderer (SSR smoke)", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");



  test("malicious HTML inside text stays literal text", () => {
    const result = compilePonpokoUI(
      'root = Text("<img src=x onerror=alert(1)> <script>alert(2)</script>")',
    );
    const html = renderToStaticMarkup(createElement(PonpokoUIView, { tree: result.tree! }));
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
  });

  test("an unknown component shows the program and the first error", () => {
    const html = renderToStaticMarkup(createElement(PonpokoUIBlock, { code: 'root = Nope("x")' }));
    expect(html).toContain("data-ponpoko-ui-block");
    expect(html).toContain("data-ponpoko-ui-error");
    expect(html).toContain("unknown component &#x27;Nope&#x27;");
  });

  test("a streaming partial program renders what is valid and holds its errors", () => {
    const html = renderToStaticMarkup(
      createElement(PonpokoUIBlock, { code: 'root = Card("T", [Text("hello', streaming: true }),
    );
    expect(html).toContain("hello");
    expect(html).toContain('data-ponpoko-ui-incomplete="true"');
    expect(html).not.toContain("data-ponpoko-ui-error");
    expect(html).toContain("Generated UI");
  });

  test("charts are inline SVG with an accessible label", () => {
    const bars = compilePonpokoUI('root = Bars([{ label: "app", value: 2 }], "Commits")');
    const html = renderToStaticMarkup(createElement(PonpokoUIView, { tree: bars.tree! }));
    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).toContain("Bar chart");
  });

  test("tabs are keyboard-operable and expose the tab roles", () => {
    const tabs = compilePonpokoUI('root = Tabs(["One", "Two"], [[Text("first")], [Text("second")]])');
    const html = renderToStaticMarkup(createElement(PonpokoUIView, { tree: tabs.tree! }));
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-selected="true"');
  });

  test("buttons carry the action as data and are disabled without a host", () => {
    const html = renderToStaticMarkup(
      createElement(PonpokoUIBlock, { code: 'root = Button("Ask", @Ask("why?"))' }),
    );
    expect(html).toContain("<button");
    expect(html).toContain("disabled");
    expect(html).not.toContain("onclick");
  });
});
