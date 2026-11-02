import type { LangSpec } from "./types";

export const TS_KEYWORDS = [
  "abstract", "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "declare", "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "from", "function", "get", "if", "implements", "import", "in", "infer",
  "instanceof", "interface", "is", "keyof", "let", "namespace", "new", "null", "of", "private",
  "protected", "public", "readonly", "return", "satisfies", "set", "static", "super", "switch",
  "this", "throw", "true", "try", "type", "typeof", "undefined", "var", "void", "while", "with",
  "yield",
];

export const TS_TYPES = [
  "any", "bigint", "boolean", "never", "number", "object", "string", "symbol", "unknown",
  "Array", "Boolean", "Date", "Error", "Map", "Number", "Object", "Promise", "Record", "Set",
  "String", "WeakMap", "WeakSet",
];

export const RUST_KEYWORDS = [
  "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern",
  "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub",
  "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe",
  "use", "where", "while", "yield",
];

export const RUST_TYPES = [
  "bool", "char", "f32", "f64", "i8", "i16", "i32", "i64", "i128", "isize", "str", "String",
  "u8", "u16", "u32", "u64", "u128", "usize", "Option", "Result", "Vec", "Box", "Arc", "Rc",
  "HashMap", "BTreeMap", "HashSet", "BTreeSet", "Cow", "Path", "PathBuf", "Duration",
];

export const PY_KEYWORDS = [
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif",
  "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while",
  "with", "yield", "match", "case",
];

export const GO_KEYWORDS = [
  "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for",
  "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select",
  "struct", "switch", "type", "var", "nil", "true", "false",
];

export const GO_TYPES = [
  "bool", "byte", "complex64", "complex128", "error", "float32", "float64", "int", "int8",
  "int16", "int32", "int64", "rune", "string", "uint", "uint8", "uint16", "uint32", "uint64",
  "uintptr", "any",
];

export const SHELL_KEYWORDS = [
  "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac",
  "function", "in", "select", "time", "coproc", "return", "exit", "export", "local", "readonly",
  "declare", "unset", "shift", "source", "alias", "echo", "printf", "cd", "pwd", "ls", "cat",
  "grep", "rg", "sed", "awk", "curl", "wget", "git", "npm", "bun", "cargo", "make", "docker",
  "kubectl", "sudo", "chmod", "mkdir", "rm", "cp", "mv", "find", "xargs", "test",
];

export const SQL_KEYWORDS = [
  "add", "all", "alter", "and", "any", "as", "asc", "begin", "between", "by", "case", "cast",
  "check", "column", "commit", "constraint", "create", "cross", "database", "default", "delete",
  "desc", "distinct", "drop", "else", "end", "exists", "explain", "false", "foreign", "from",
  "full", "group", "having", "if", "in", "index", "inner", "insert", "into", "is", "join", "key",
  "left", "like", "limit", "not", "null", "offset", "on", "or", "order", "outer", "primary",
  "references", "returning", "right", "rollback", "select", "set", "table", "then", "true",
  "union", "unique", "update", "using", "values", "view", "when", "where", "with",
];

export const CSS_KEYWORDS = [
  "important", "media", "import", "keyframes", "font-face", "supports", "layer", "container",
  "from", "to", "and", "or", "not", "only", "screen", "print",
];

export const YAML_KEYWORDS = ["true", "false", "null", "yes", "no", "on", "off"];

export const LANGS: Record<string, LangSpec> = {
  ts: {
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"', "'", "`"],
    keywords: TS_KEYWORDS,
    types: TS_TYPES,
    upperIsType: true,
  },
  rust: {
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"'],
    keywords: RUST_KEYWORDS,
    types: RUST_TYPES,
    upperIsType: true,
  },
  python: {
    lineComment: ["#"],
    quotes: ['"', "'"],
    keywords: PY_KEYWORDS,
    types: ["int", "float", "str", "bool", "list", "dict", "set", "tuple", "bytes", "object"],
    upperIsType: true,
    tripleQuotes: true,
  },
  go: {
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"', "`"],
    keywords: GO_KEYWORDS,
    types: GO_TYPES,
    upperIsType: true,
    rawBacktick: true,
  },
  json: {
    quotes: ['"'],
    keywords: ["true", "false", "null"],
    types: [],
  },
  shell: {
    lineComment: ["#"],
    quotes: ['"', "'"],
    keywords: SHELL_KEYWORDS,
    types: [],
    hashCommentNeedsSpace: true,
    shellVars: true,
  },
  sql: {
    lineComment: ["--"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
    keywords: SQL_KEYWORDS,
    types: ["text", "integer", "bigint", "boolean", "date", "timestamp", "numeric", "jsonb", "uuid"],
    caseInsensitive: true,
  },
  css: {
    blockComment: ["/*", "*/"],
    quotes: ['"', "'"],
    keywords: CSS_KEYWORDS,
    types: [],
  },
  yaml: {
    lineComment: ["#"],
    quotes: ['"', "'"],
    keywords: YAML_KEYWORDS,
    types: [],
  },
  diff: {
    keywords: [],
    types: [],
  },
  html: {
    blockComment: ["<!--", "-->"],
    quotes: [],
    keywords: [],
    types: [],
  },
  plain: { keywords: [], types: [] },
};
