export type TokenKind =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "operator"
  | "punctuation"
  | "insert"
  | "delete"
  | "meta";

export interface Token {
  kind: TokenKind;
  text: string;
}

export interface LangSpec {
  lineComment?: string[];
  blockComment?: [string, string];
  quotes?: string[];
  keywords: string[];
  types: string[];
  caseInsensitive?: boolean;
  upperIsType?: boolean;
  hashCommentNeedsSpace?: boolean;
  tripleQuotes?: boolean;
  rawBacktick?: boolean;
  shellVars?: boolean;
}
