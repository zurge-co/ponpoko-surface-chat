import { closingSuffix, lexPonpokoUI, type Token, type PonpokoUIError } from "./lexer";

export interface PonpokoUIStatement {
  name: string;
  expr: PonpokoUIExpr;
  at: number;
}

export type BinaryOperator =
  | "||"
  | "&&"
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "+"
  | "-"
  | "*"
  | "/";

export type PonpokoUIExpr =
  | { type: "literal"; value: string | number | boolean | null; at: number }
  | { type: "ref"; name: string; at: number }
  | { type: "array"; items: PonpokoUIExpr[]; at: number }
  | { type: "object"; entries: { key: string; value: PonpokoUIExpr }[]; at: number }
  | { type: "call"; name: string; args: PonpokoUIExpr[]; at: number }
  | { type: "invoke"; name: string; args: PonpokoUIExpr[]; at: number }
  | { type: "member"; object: PonpokoUIExpr; prop: string; at: number }
  | { type: "index"; object: PonpokoUIExpr; index: PonpokoUIExpr; at: number }
  | { type: "unary"; op: "!" | "-"; operand: PonpokoUIExpr; at: number }
  | { type: "binary"; op: BinaryOperator; left: PonpokoUIExpr; right: PonpokoUIExpr; at: number }
  | { type: "ternary"; test: PonpokoUIExpr; then: PonpokoUIExpr; otherwise: PonpokoUIExpr; at: number };

export interface PonpokoUIProgram {
  statements: PonpokoUIStatement[];
  length: number;
}

export interface ParsedPonpokoUI {
  program: PonpokoUIProgram;
  incomplete: boolean;
  errors: PonpokoUIError[];
}

class PonpokoUIParseFailure extends Error {
  readonly index: number;

  constructor(message: string, index: number) {
    super(message);
    this.index = index;
  }
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  private errors: PonpokoUIError[] = [];
  private statementIndex = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  getErrors(): PonpokoUIError[] {
    return this.errors;
  }

  parseProgram(): PonpokoUIStatement[] {
    const statements: PonpokoUIStatement[] = [];
    for (;;) {
      this.skipNewlines();
      if (this.atEnd()) break;

      const statementIndex = this.statementIndex;
      this.statementIndex += 1;
      const before = this.pos;

      try {
        const statement = this.parseStatement();
        statements.push(statement);
        if (!this.atEnd() && !this.check("newline")) {
          const token = this.peek();
          this.errors.push({
            message: `unexpected '${token.value}' after the value of '${statement.name}'`,
            index: token.start,
            statement: statementIndex,
          });
          this.skipToStatementEnd();
        } else {
          this.matchNewline();
        }
      } catch (error) {
        if (!(error instanceof PonpokoUIParseFailure)) throw error;
        this.errors.push({
          message: error.message,
          index: error.index,
          statement: statementIndex,
        });
        this.skipToStatementEnd();
        if (this.pos === before) this.next();
      }
    }
    return statements;
  }

  private parseStatement(): PonpokoUIStatement {
    const token = this.peek();
    if (token.type !== "ident") {
      throw new PonpokoUIParseFailure(
        "a statement starts with a name, like `root = Card(...)`",
        token.start,
      );
    }
    this.next();
    if (!this.matchPunct("=")) {
      throw new PonpokoUIParseFailure(
        `'${token.value}' needs '=' — a statement is \`name = expression\``,
        this.peek().start,
      );
    }
    const expr = this.parseExpression();
    return { name: token.value, expr, at: token.start };
  }


  private parseExpression(): PonpokoUIExpr {
    return this.parseTernary();
  }

  private parseTernary(): PonpokoUIExpr {
    const test = this.parseOr();
    if (!this.matchPunct("?")) return test;
    const then = this.parseExpression();
    if (!this.matchPunct(":")) {
      throw new PonpokoUIParseFailure("a ternary needs ':' between its two values", this.peek().start);
    }
    const otherwise = this.parseExpression();
    return { type: "ternary", test, then, otherwise, at: test.at };
  }

  private parseOr(): PonpokoUIExpr {
    let left = this.parseAnd();
    while (this.matchPunct("||")) {
      const right = this.parseAnd();
      left = { type: "binary", op: "||", left, right, at: left.at };
    }
    return left;
  }

  private parseAnd(): PonpokoUIExpr {
    let left = this.parseEquality();
    while (this.matchPunct("&&")) {
      const right = this.parseEquality();
      left = { type: "binary", op: "&&", left, right, at: left.at };
    }
    return left;
  }

  private parseEquality(): PonpokoUIExpr {
    let left = this.parseComparison();
    for (;;) {
      const op = this.matchAnyPunct(["==", "!="]);
      if (!op) return left;
      const right = this.parseComparison();
      left = { type: "binary", op: op as BinaryOperator, left, right, at: left.at };
    }
  }

  private parseComparison(): PonpokoUIExpr {
    let left = this.parseAdditive();
    for (;;) {
      const op = this.matchAnyPunct([">", "<", ">=", "<="]);
      if (!op) return left;
      const right = this.parseAdditive();
      left = { type: "binary", op: op as BinaryOperator, left, right, at: left.at };
    }
  }

  private parseAdditive(): PonpokoUIExpr {
    let left = this.parseMultiplicative();
    for (;;) {
      const op = this.matchAnyPunct(["+", "-"]);
      if (!op) return left;
      const right = this.parseMultiplicative();
      left = { type: "binary", op: op as BinaryOperator, left, right, at: left.at };
    }
  }

  private parseMultiplicative(): PonpokoUIExpr {
    let left = this.parseUnary();
    for (;;) {
      const op = this.matchAnyPunct(["*", "/"]);
      if (!op) return left;
      const right = this.parseUnary();
      left = { type: "binary", op: op as BinaryOperator, left, right, at: left.at };
    }
  }

  private parseUnary(): PonpokoUIExpr {
    const token = this.peek();
    if (this.matchPunct("!")) {
      return { type: "unary", op: "!", operand: this.parseUnary(), at: token.start };
    }
    if (this.matchPunct("-")) {
      return { type: "unary", op: "-", operand: this.parseUnary(), at: token.start };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): PonpokoUIExpr {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.matchPunct(".")) {
        const prop = this.next();
        if (prop.type !== "ident") {
          throw new PonpokoUIParseFailure("a property name is needed after '.'", prop.start);
        }
        expr = { type: "member", object: expr, prop: prop.value, at: expr.at };
        continue;
      }
      if (this.matchPunct("[")) {
        const index = this.parseExpression();
        if (!this.matchPunct("]")) {
          throw new PonpokoUIParseFailure("an index needs a closing ']'", this.peek().start);
        }
        expr = { type: "index", object: expr, index, at: expr.at };
        continue;
      }
      return expr;
    }
  }

  private parsePrimary(): PonpokoUIExpr {
    const token = this.peek();

    if (token.type === "string") {
      this.next();
      return { type: "literal", value: token.value, at: token.start };
    }

    if (token.type === "number") {
      this.next();
      const value = Number(token.value);
      if (!Number.isFinite(value)) {
        throw new PonpokoUIParseFailure(`'${token.value}' is not a number`, token.start);
      }
      return { type: "literal", value, at: token.start };
    }

    if (token.type === "ident") {
      this.next();
      if (token.value === "true") return { type: "literal", value: true, at: token.start };
      if (token.value === "false") return { type: "literal", value: false, at: token.start };
      if (token.value === "null") return { type: "literal", value: null, at: token.start };
      if (this.matchPunct("(")) {
        return {
          type: "call",
          name: token.value,
          args: this.parseArguments(")"),
          at: token.start,
        };
      }
      return { type: "ref", name: token.value, at: token.start };
    }

    if (token.type === "at") {
      this.next();
      const nameToken = this.next();
      if (nameToken.type !== "ident") {
        throw new PonpokoUIParseFailure("a function or action name is needed after '@'", nameToken.start);
      }
      if (!this.matchPunct("(")) {
        throw new PonpokoUIParseFailure(
          `'@${nameToken.value}' needs arguments in parentheses`,
          this.peek().start,
        );
      }
      return {
        type: "invoke",
        name: nameToken.value,
        args: this.parseArguments(")"),
        at: token.start,
      };
    }

    if (this.matchPunct("(")) {
      const inner = this.parseExpression();
      if (!this.matchPunct(")")) {
        throw new PonpokoUIParseFailure("a group needs a closing ')'", this.peek().start);
      }
      return inner;
    }

    if (this.matchPunct("[")) return this.parseArray(token.start);

    if (this.matchPunct("{")) return this.parseObject(token.start);

    throw new PonpokoUIParseFailure(
      token.type === "punct"
        ? `expected a value before '${token.value}'`
        : "expected a value",
      token.start,
    );
  }

  private parseArray(at: number): PonpokoUIExpr {
    const items: PonpokoUIExpr[] = [];
    if (this.matchPunct("]")) return { type: "array", items, at };
    for (;;) {
      items.push(this.parseExpression());
      if (this.matchPunct("]")) return { type: "array", items, at };
      if (!this.matchPunct(",")) {
        throw new PonpokoUIParseFailure("a list needs ',' between its values", this.peek().start);
      }
      if (this.matchPunct("]")) return { type: "array", items, at };
    }
  }

  private parseObject(at: number): PonpokoUIExpr {
    const entries: { key: string; value: PonpokoUIExpr }[] = [];
    if (this.matchPunct("}")) return { type: "object", entries, at };
    for (;;) {
      const keyToken = this.next();
      if (keyToken.type !== "ident" && keyToken.type !== "string") {
        throw new PonpokoUIParseFailure("an object key must be a name or a string", keyToken.start);
      }
      if (!this.matchPunct(":")) {
        throw new PonpokoUIParseFailure("an object entry is `key: value`", this.peek().start);
      }
      const value = this.parseExpression();
      entries.push({ key: keyToken.value, value });
      if (this.matchPunct("}")) return { type: "object", entries, at };
      if (!this.matchPunct(",")) {
        throw new PonpokoUIParseFailure("an object needs ',' between its entries", this.peek().start);
      }
      if (this.matchPunct("}")) return { type: "object", entries, at };
    }
  }

  private parseArguments(close: string): PonpokoUIExpr[] {
    const args: PonpokoUIExpr[] = [];
    if (this.matchPunct(close)) return args;
    for (;;) {
      args.push(this.parseExpression());
      if (this.matchPunct(close)) return args;
      if (!this.matchPunct(",")) {
        throw new PonpokoUIParseFailure(`expected ',' or '${close}'`, this.peek().start);
      }
      if (this.matchPunct(close)) return args;
    }
  }


  private peek(): Token {
    return this.tokens[this.pos] ?? { type: "eof", value: "", start: 0, end: 0 };
  }

  private next(): Token {
    const token = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos += 1;
    return token;
  }

  private atEnd(): boolean {
    return this.peek().type === "eof";
  }

  private check(type: Token["type"]): boolean {
    return this.peek().type === type;
  }

  private matchNewline(): boolean {
    if (!this.check("newline")) return false;
    this.next();
    return true;
  }

  private skipNewlines(): void {
    while (this.check("newline")) this.next();
  }

  private checkPunct(value: string): boolean {
    const token = this.peek();
    return token.type === "punct" && token.value === value;
  }

  private matchPunct(value: string): boolean {
    if (!this.checkPunct(value)) return false;
    this.next();
    return true;
  }

  private matchAnyPunct(values: string[]): string | null {
    const token = this.peek();
    if (token.type !== "punct") return null;
    if (!values.includes(token.value)) return null;
    this.next();
    return token.value;
  }

  private skipToStatementEnd(): void {
    while (!this.atEnd() && !this.check("newline")) this.next();
    this.matchNewline();
  }
}

function parseTokens(tokens: Token[]): { statements: PonpokoUIStatement[]; errors: PonpokoUIError[] } {
  const parser = new Parser(tokens);
  const statements = parser.parseProgram();
  return { statements, errors: parser.getErrors() };
}

function tokensBeforeLastStatement(tokens: Token[]): Token[] {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i]!.type === "newline") {
      const prefix = tokens.slice(0, i);
      const last = prefix[prefix.length - 1];
      return [
        ...prefix,
        { type: "eof", value: "", start: last?.end ?? 0, end: last?.end ?? 0 },
      ];
    }
  }
  return [{ type: "eof", value: "", start: 0, end: 0 }];
}

function looksUnfinished(source: string): boolean {
  const trimmed = source.trimEnd();
  if (trimmed.length === 0) return true;
  return "=+-*/?:,.([{&|<>!".includes(trimmed[trimmed.length - 1]!);
}

export function parsePonpokoUI(source: string): ParsedPonpokoUI {
  if (source.trim().length === 0) {
    return {
      program: { statements: [], length: source.length },
      incomplete: true,
      errors: [],
    };
  }

  const lex = lexPonpokoUI(source);
  const unbalanced = lex.open.length > 0 || lex.unterminatedString;

  if (unbalanced) {
    const repaired = parseTokens(lexPonpokoUI(source + closingSuffix(lex)).tokens);
    if (repaired.errors.length === 0) {
      return {
        program: { statements: repaired.statements, length: source.length },
        incomplete: true,
        errors: lex.errors,
      };
    }
    const prefix = parseTokens(tokensBeforeLastStatement(lex.tokens));
    return {
      program: { statements: prefix.statements, length: source.length },
      incomplete: true,
      errors: [...lex.errors, ...prefix.errors],
    };
  }

  const parsed = parseTokens(lex.tokens);

  if (parsed.errors.length > 0 && looksUnfinished(source)) {
    const tail = Math.max(...parsed.errors.map((error) => error.statement ?? -1));
    const isFinalStatement =
      parsed.errors.every((error) => (error.statement ?? -1) === tail) &&
      tail >= parsed.statements.length - 1;
    if (isFinalStatement) {
      const prefix = parseTokens(tokensBeforeLastStatement(lex.tokens));
      return {
        program: { statements: prefix.statements, length: source.length },
        incomplete: true,
        errors: [...lex.errors, ...prefix.errors],
      };
    }
  }

  return {
    program: { statements: parsed.statements, length: source.length },
    incomplete: false,
    errors: [...lex.errors, ...parsed.errors],
  };
}
