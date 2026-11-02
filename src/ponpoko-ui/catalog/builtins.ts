import type { PonpokoUIBuiltin, PonpokoUIActionDef } from "./types";

export const PONPOKO_UI_BUILTINS: readonly PonpokoUIBuiltin[] = [
  {
    name: "Count",
    signature: "@Count(items: any[]) -> number",
    description: "How many items are in a list.",
    example: "@Count(findings)",
  },
  {
    name: "Sum",
    signature: "@Sum(values: number[]) -> number",
    description: "Adds a list of numbers.",
    example: "@Sum([3, 4, 5])",
  },
  {
    name: "Avg",
    signature: "@Avg(values: number[]) -> number",
    description: "The arithmetic mean of a non-empty list of numbers.",
    example: "@Avg([3, 4, 5])",
  },
  {
    name: "Percent",
    signature: "@Percent(value: number, total: number) -> string",
    description: 'A rounded percentage such as "75%".',
    example: "@Percent(3, 4)",
  },
  {
    name: "Join",
    signature: '@Join(values: string[], separator?: string) -> string',
    description: 'Joins strings with ", " unless a separator is given.',
    example: '@Join(["a", "b"], " · ")',
  },
];

export const BUILTIN_BY_NAME = new Map(PONPOKO_UI_BUILTINS.map((b) => [b.name, b]));

export function builtinByName(name: string): PonpokoUIBuiltin | undefined {
  return BUILTIN_BY_NAME.get(name);
}


export const PONPOKO_UI_ACTIONS: readonly PonpokoUIActionDef[] = [
  {
    name: "ask",
    signature: "@Ask(text: string) -> Action",
    description: "Pre-fill the composer with a follow-up question. Never sends it.",
    example: '@Ask("Explain the first finding")',
  },
  {
    name: "copy",
    signature: "@Copy(text: string) -> Action",
    description: "Copy text to the clipboard.",
    example: '@Copy("src/a.ts, src/b.ts")',
  },
  {
    name: "insert",
    signature: "@Insert(text: string) -> Action",
    description: "Append text to the composer without sending it.",
    example: '@Insert("Also check src/c.ts")',
  },
  {
    name: "open",
    signature: "@Open(url: string) -> Action",
    description: "Open an http:// or https:// link in the system browser. No other scheme.",
    example: '@Open("https://example.com/docs")',
  },
];

export const ACTION_BY_NAME = new Map<string, PonpokoUIActionDef>(PONPOKO_UI_ACTIONS.map((a) => [a.name, a]));

export function actionByName(name: string): PonpokoUIActionDef | undefined {
  return ACTION_BY_NAME.get(name);
}

export function isSafeOpenUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 4096) return false;
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (/\s/.test(char) || code < 0x20 || code === 0x7f) return false;
  }
  const match = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(trimmed);
  if (!match) return false;
  const authority = match[1] ?? "";
  return authority.length > 0 && !authority.startsWith(".") && !authority.endsWith(".");
}
