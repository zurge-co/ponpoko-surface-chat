const { describe, test, expect } = await import("bun:test");

const { lexPonpokoUI } = await import("../src/ponpoko-ui/lexer");

const kinds = (source: string) =>
  lexPonpokoUI(source)
    .tokens.filter((token) => token.type !== "eof")
    .map((token) => `${token.type}:${token.value}`);

describe("the lexer turns a PonpokoUI program into tokens", () => {
  test("names, numbers, strings and punctuation keep their order", () => {
    expect(kinds('title = "hi"')).toEqual(["ident:title", "punct:=", "string:hi"]);
    expect(kinds("count = 42")).toEqual(["ident:count", "punct:=", "number:42"]);
  });

  test("a decimal, a leading dot and an exponent are all numbers", () => {
    expect(kinds("1.5 .5 2e3 1e+3")).toEqual(["number:1.5", "number:.5", "number:2e3", "number:1e+3"]);
  });

  test("a name may carry digits and underscores but may not start with a digit", () => {
    expect(kinds("value_2")).toEqual(["ident:value_2"]);
    expect(kinds("2value")).toEqual(["number:2", "ident:value"]);
  });

  test("an at-sign is its own token, so a directive is never confused with a name", () => {
    expect(kinds("@root")).toEqual(["at:@", "ident:root"]);
  });

  test("two-character operators are one token, not two", () => {
    expect(kinds("a && b || c == d != e <= f >= g")).toEqual([
      "ident:a",
      "punct:&&",
      "ident:b",
      "punct:||",
      "ident:c",
      "punct:==",
      "ident:d",
      "punct:!=",
      "ident:e",
      "punct:<=",
      "ident:f",
      "punct:>=",
      "ident:g",
    ]);
  });

  test("every token records where it starts and ends in the source", () => {
    const [first, second] = lexPonpokoUI("ab cd").tokens;
    expect([first.start, first.end]).toEqual([0, 2]);
    expect([second.start, second.end]).toEqual([3, 5]);
  });

  test("the stream always ends with an eof token", () => {
    const { tokens } = lexPonpokoUI("a");
    expect(tokens[tokens.length - 1]).toMatchObject({ type: "eof", value: "" });
  });
});

describe("strings are read the way the language documents them", () => {
  test("single and double quotes both delimit a string", () => {
    expect(kinds("'one' \"two\"")).toEqual(["string:one", "string:two"]);
  });

  test("an escaped quote and the documented escapes become their character", () => {
    const [token] = lexPonpokoUI('"a\\"b\\n\\t"').tokens;
    expect(token.value).toBe('a"b\n\t');
  });

  test("an unterminated string is reported, with the quote that was left open", () => {
    const result = lexPonpokoUI('a = "oops');
    expect(result.unterminatedString).toBe(true);
    expect(result.openQuote).toBe('"');
    expect(result.tokens.some((token) => token.type === "string" && token.terminated === false)).toBe(
      true,
    );
  });
});

describe("separators and brackets are tracked, not guessed", () => {
  test("a newline ends a statement at the top level", () => {
    expect(kinds("a = 1\nb = 2")).toEqual([
      "ident:a",
      "punct:=",
      "number:1",
      "newline:\n",
      "ident:b",
      "punct:=",
      "number:2",
    ]);
  });

  test("a newline inside brackets is layout, not a statement end", () => {
    expect(kinds("[\n1\n]")).toEqual(["punct:[", "number:1", "punct:]"]);
  });

  test("a semicolon separates statements the way a newline does", () => {
    expect(kinds("a = 1; b = 2")).toEqual([
      "ident:a",
      "punct:=",
      "number:1",
      "newline:;",
      "ident:b",
      "punct:=",
      "number:2",
    ]);
  });

  test("an unclosed bracket is remembered so the editor can say what is missing", () => {
    expect(lexPonpokoUI("a = (1").open).toEqual(["("]);
  });

  test("a closer without an opener is an error at its own index", () => {
    const result = lexPonpokoUI("a = 1)");
    expect(result.errors[0]).toMatchObject({ index: 5 });
    expect(result.errors[0].message).toContain(")");
  });

  test("a character the language has no meaning for is an error, and lexing continues", () => {
    const result = lexPonpokoUI("a = $b");
    expect(result.errors[0]).toMatchObject({ index: 4 });
    expect(result.tokens.some((token) => token.type === "ident" && token.value === "b")).toBe(true);
  });
});
