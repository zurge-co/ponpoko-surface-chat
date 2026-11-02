import { expect, test } from "bun:test";
import { applyPalette } from "../src/lib/palette";

test("palette replacement updates interactive colours and follows its own scheme", () => {
  const written = new Map<string, string>();
  const root = { style: { colorScheme: "", setProperty: (key: string, value: string) => written.set(key, value) }, dataset: {} } as unknown as HTMLElement;
  applyPalette({ base: "#e6e9dc", panel_hover: "#e1e7d6", accent: "#3c702f", border: "#56654b" }, root);
  expect(root.style.colorScheme).toBe("light");
  expect(written.get("--color-panel-hover")).toBe("#e1e7d6");
  expect(written.get("--color-border")).toBe("rgba(86, 101, 75, 0.18)");
  applyPalette({ base: "#241811", panel_hover: "#32241a", accent: "#a8d25c", border: "#f7f0e3", fg: "url(invalid)" }, root);
  expect(root.style.colorScheme).toBe("dark");
  expect(written.get("--color-panel-hover")).toBe("#32241a");
  expect(written.get("--color-border")).toBe("rgba(247, 240, 227, 0.06)");
  expect(written.has("--color-fg")).toBe(false);
});
