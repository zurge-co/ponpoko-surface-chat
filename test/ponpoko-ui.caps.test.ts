const { describe, test, expect } = await import("bun:test");

const catalog = await import("../src/ponpoko-ui/catalog");

describe("a program is bounded before it is drawn", () => {
  test("every bound is a positive number, so no drawing can be unbounded", () => {
    for (const [, limit] of Object.entries(catalog.PONPOKO_UI_CAPS)) {
      expect(typeof limit).toBe("number");
      expect(limit).toBeGreaterThan(0);
    }
  });

  test("the node budget is smaller than the character budget, so text cannot buy nodes", () => {
    expect(catalog.PONPOKO_UI_CAPS.nodes).toBeLessThan(catalog.PONPOKO_UI_CAPS.programChars);
    expect(catalog.PONPOKO_UI_CAPS.depth).toBeLessThan(catalog.PONPOKO_UI_CAPS.nodes);
  });

  test("a table and a chart have their own row and point budgets", () => {
    expect(catalog.PONPOKO_UI_CAPS.tableRows).toBeGreaterThan(0);
    expect(catalog.PONPOKO_UI_CAPS.chartPoints).toBeGreaterThan(0);
    expect(catalog.PONPOKO_UI_CAPS.tableRows).toBeLessThan(catalog.PONPOKO_UI_CAPS.nodes);
  });

  test("the budget set is exactly the six documented limits", () => {
    expect(Object.keys(catalog.PONPOKO_UI_CAPS).sort()).toEqual([
      "chartPoints",
      "depth",
      "nodes",
      "programChars",
      "stringChars",
      "tableRows",
    ]);
    expect(catalog.PONPOKO_UI_CAPS.stringChars).toBeLessThan(catalog.PONPOKO_UI_CAPS.programChars);
  });
});

describe("built-ins compute what a writer would otherwise have to send", () => {
  test("they are found by name like components are", () => {
    expect(catalog.builtinByName("Count")?.name).toBe("Count");
    expect(catalog.builtinByName("Sum")?.name).toBe("Sum");
  });

  test("an unknown built-in is undefined", () => {
    expect(catalog.builtinByName("Eval")).toBeUndefined();
  });

  test("the built-in list has no duplicate names", () => {
    const names = catalog.PONPOKO_UI_BUILTINS.map((builtin) => builtin.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.sort()).toEqual(["Avg", "Count", "Join", "Percent", "Sum"]);
  });
});

describe("the four actions are the only things a drawing may do", () => {
  test("each action is one of ask, copy, insert and open", () => {
    expect(catalog.PONPOKO_UI_ACTIONS.map((action) => action.name).sort()).toEqual([
      "ask",
      "copy",
      "insert",
      "open",
    ]);
  });

  test("an action the surface did not declare is undefined, so it cannot run", () => {
    expect(catalog.actionByName("delete")).toBeUndefined();
    expect(catalog.actionByName("open")?.name).toBe("open");
  });
});
