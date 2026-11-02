const { describe, test, expect } = await import("bun:test");

const catalog = await import("../src/ponpoko-ui/catalog");

describe("the drawable set is closed and named", () => {
  test("a known component is found by its exact name", () => {
    expect(catalog.componentByName("Card")?.name).toBe("Card");
    expect(catalog.componentByName("Text")?.name).toBe("Text");
  });

  test("an unknown name is undefined, not a guess", () => {
    expect(catalog.componentByName("card")).toBeUndefined();
    expect(catalog.componentByName("iframe")).toBeUndefined();
  });

  test("the component list has no duplicate names", () => {
    const names = catalog.PONPOKO_UI_COMPONENT_NAMES;
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(0);
  });

  test("every component declares a signature a writer can follow", () => {
    for (const component of catalog.PONPOKO_UI_COMPONENTS) {
      expect(component.signature ?? catalog.componentSignature(component)).toBeTruthy();
    }
  });

  test("actions are drawn from the same closed set", () => {
    expect(catalog.actionByName("ask")).toBeTruthy();
    expect(catalog.actionByName("fetch")).toBeUndefined();
  });
});

describe("a prop type is rendered the way the prompt writes it", () => {
  test("a plain type is its own name", () => {
    expect(catalog.propTypeName({ kind: "string" })).toBe("string");
    expect(catalog.propTypeName({ kind: "number" })).toBe("number");
  });

  test("an element list is spelled as the component type", () => {
    expect(catalog.propTypeName({ kind: "elements" })).toBe("Component[]");
  });

  test("an enum lists its allowed values as literals", () => {
    expect(catalog.propTypeName({ kind: "enum", values: ["primary", "ghost"] })).toBe(
      '"primary" | "ghost"',
    );
  });

  test("a required prop is required unless it says otherwise", () => {
    expect(catalog.isRequired({ name: "title", type: { kind: "string" } })).toBe(true);
    expect(catalog.isRequired({ name: "x", type: { kind: "string" }, required: false })).toBe(false);
  });

  test("the required argument count is the count of required props", () => {
    const button = catalog.componentByName("Button")!;
    expect(catalog.requiredArgumentCount(button)).toBe(
      button.props.filter((prop) => catalog.isRequired(prop)).length,
    );
    expect(catalog.requiredArgumentCount(button)).toBe(2);
  });
});

describe("a signature is one line a writer can copy", () => {
  test("optional props are marked with a question mark", () => {
    expect(catalog.componentSignature(catalog.componentByName("Card")!)).toBe(
      "Card(title: string, children: Component[], footnote?: string)",
    );
  });

  test("an enum prop prints its values in the signature", () => {
    expect(catalog.componentSignature(catalog.componentByName("Button")!)).toContain(
      'variant?: "primary" | "ghost" | "danger"',
    );
  });
});

describe("an open action may only carry a real link", () => {
  test("http and https links are allowed, in either case", () => {
    expect(catalog.isSafeOpenUrl("https://example.test/a")).toBe(true);
    expect(catalog.isSafeOpenUrl("http://example.test")).toBe(true);
    expect(catalog.isSafeOpenUrl("HTTPS://EXAMPLE.TEST")).toBe(true);
  });

  test("a script URL, a relative path and a mail link are refused", () => {
    expect(catalog.isSafeOpenUrl("javascript:alert(1)")).toBe(false);
    expect(catalog.isSafeOpenUrl("/etc/passwd")).toBe(false);
    expect(catalog.isSafeOpenUrl("mailto:a@b.test")).toBe(false);
  });
});
