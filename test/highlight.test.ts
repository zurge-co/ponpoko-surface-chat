const { describe, test, expect } = await import("bun:test");

const { highlight, languageLabel, normalizeLang, tokenText } = await import(
  "../src/chat/highlight"
);

const samples: [string, string][] = [
  ["ts", "// note\nconst answer: number = 42;\nfunction add(a: number) { return a + 1; }"],
  ["rust", "/// doc\npub fn main() -> Result<(), String> {\n    let x: u32 = 1; // ok\n    Ok(())\n}"],
  ["python", "# note\n\"\"\"doc\"\"\"\ndef run(value: int) -> str:\n    return f\"{value}\""],
  ["go", "package main\nfunc main() {\n\tfmt.Println(\"hi\")\n}"],
  ["json", "{\"ok\": true, \"count\": 2, \"items\": null}"],
  ["shell", "#!/bin/sh\nset -eu\nfor f in \"$@\"; do echo \"$f\"; done"],
  ["sql", "SELECT id, name FROM users WHERE id = $1 -- note"],
  ["yaml", "name: Ponpoko\ncount: 2\nitems:\n  - one\n  - two"],
  ["css", ".a { color: #fff; margin: 1px } /* note */"],
  ["html", "<div class=\"x\">hello &amp; bye</div><!-- note -->"],
  ["diff", "@@ -1,2 +1,2 @@\n-old\n+new\n context"],
  ["unknown-lang", "some <raw> text"],
];

describe("highlight", () => {
  test("never loses or changes a character", () => {
    for (const [lang, code] of samples) {
      expect(tokenText(highlight(code, lang))).toBe(code);
    }
  });

  test("recognises comments, strings, numbers and keywords", () => {
    const kinds = new Set(highlight(samples[0]![1], "ts").map((token) => token.kind));
    expect(kinds.has("comment")).toBe(true);
    expect(kinds.has("keyword")).toBe(true);
    expect(kinds.has("number")).toBe(true);
    expect(kinds.has("function")).toBe(true);
    expect(kinds.has("type")).toBe(true);
  });

  test("rust keywords and types are separate", () => {
    const tokens = highlight("pub fn main() -> Result<(), String> {}", "rust");
    expect(tokens.some((token) => token.kind === "keyword" && token.text === "pub")).toBe(true);
    expect(tokens.some((token) => token.kind === "type" && token.text === "Result")).toBe(true);
  });

  test("diff lines are marked insert/delete/meta", () => {
    const tokens = highlight(samples[10]![1], "diff");
    expect(tokens.some((token) => token.kind === "insert")).toBe(true);
    expect(tokens.some((token) => token.kind === "delete")).toBe(true);
    expect(tokens.some((token) => token.kind === "meta")).toBe(true);
  });

  test("an unknown language is plain text", () => {
    const tokens = highlight("some <raw> text", "not-a-language");
    expect(tokens.every((token) => token.kind === "plain")).toBe(true);
  });

  test("aliases and labels are stable", () => {
    expect(normalizeLang("TSX")).toBe("ts");
    expect(normalizeLang("rs")).toBe("rust");
    expect(normalizeLang("yml")).toBe("yaml");
    expect(languageLabel("ts")).toBe("TypeScript");
    expect(languageLabel("weird")).toBe("weird");
  });
});
