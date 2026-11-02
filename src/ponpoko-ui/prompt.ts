import {
  PONPOKO_UI_ACTIONS,
  PONPOKO_UI_BUILTINS,
  PONPOKO_UI_CAPS,
  PONPOKO_UI_COMPONENTS,
  componentSignature,
  propTypeName,
} from "./catalog";

export const PONPOKO_UI_PROMPT_EXAMPLES: readonly string[] = [
  `findings = [["src/a.ts", "unused import"], ["src/b.ts", "missing null check"]]

root = Stack([
  Heading("Review", 3),
  Row([Metric("Files", 2), Metric("Findings", @Count(findings))]),
  Table(["File", "Problem"], findings, "Findings"),
  Buttons([
    Button("Ask about the null check", @Ask("Explain the missing null check in src/b.ts")),
    Button("Copy the file list", @Copy("src/a.ts, src/b.ts"))
  ])
])`,
  `root = Card("Plan", [
  Steps(steps, "Plan"),
  Callout("Safety", [Text("This only adds tables.")], "success"),
  Progress("Steps done", 1, @Count(steps))
])

steps = [
  { title: "Read the schema", status: "done" },
  { title: "Add the prompt table", status: "doing" },
  { title: "Run the suites", status: "todo" }
]`,
];

const RULES: readonly string[] = [
  "Put the explanation in normal prose. Add at most one ```ponpoko-ui fenced block when a visual genuinely helps; never wrap the program in HTML.",
  "The block contains only PonpokoUI statements. Everything the model says in prose outside the block is still rendered as markdown.",
  "The component vocabulary is closed. Do not invent components, props, functions or actions — the lists above are complete.",
  "Arguments are positional and follow the signature order. Required arguments come first; trailing `?` arguments may be omitted, or skipped with `null`.",
  "A program ends with a `root` statement that calls a component. References may be defined after the statement that uses them.",
  "Components render children passed explicitly. A child must itself be a component call; text is never a child — use Text(...).",
  "Actions are data: @Ask pre-fills the composer, @Copy copies, @Insert appends to the composer, @Open opens an http(s) link. No action runs work, writes files or calls the host.",
  "Keep programs small: at most " +
    PONPOKO_UI_CAPS.nodes +
    " rendered components, " +
    PONPOKO_UI_CAPS.tableRows +
    " table rows and " +
    PONPOKO_UI_CAPS.chartPoints +
    " chart points. Long prose belongs outside the block.",
  "Quote strings with double quotes and escape a quote or backslash with a backslash. Numbers, booleans and null are written bare.",
  "Prefer plain, factual labels. Do not fabricate numbers; compute them with the built-ins from values you actually have.",
];

function componentSection(): string {
  return PONPOKO_UI_COMPONENTS.map((component) => {
    const optional = component.props.filter((prop) => prop.required === false);
    const optionalNote =
      optional.length > 0
        ? ` (optional: ${optional
            .map((prop) => `${prop.name}: ${propTypeName(prop.type)}`)
            .join("; ")})`
        : "";
    return [
      componentSignature(component),
      `  ${component.description}${optionalNote}`,
      `  Example: ${component.example}`,
    ].join("\n");
  }).join("\n\n");
}

function builtinSection(): string {
  return PONPOKO_UI_BUILTINS.map(
    (builtin) => `${builtin.signature}\n  ${builtin.description}\n  Example: ${builtin.example}`,
  ).join("\n\n");
}

function actionSection(): string {
  return PONPOKO_UI_ACTIONS.map(
    (action) => `${action.signature}\n  ${action.description}\n  Example: ${action.example}`,
  ).join("\n\n");
}

export const PONPOKO_UI_CHAT_ONLY = `This fence is how the conversation shows something. It is not a surface: a surface is a bundle the human installs in the tab bar, and it outlives the reply. When the human asks for a screen, a tool or anything that must still exist tomorrow, build a surface — never answer a request for one with a program here.`;

let cached: string | null = null;

export function buildPonpokoUISystemPrompt(): string {
  if (cached !== null) return cached;
  cached = [
    "PONPOKO GENERATIVE UI (PonpokoUI)",
    PONPOKO_UI_CHAT_ONLY,
    "Ponpoko can render a reply as real UI instead of only prose. A fenced block whose info string is `ponpoko-ui` is a PonpokoUI program written in a small, closed language: statements of the form `name = expression`, with `root` as the entry component. Prose outside the block is rendered as markdown, so use one block when a card, table, diff, chart, steps, callout or follow-up button says it better than a paragraph.",
    "",
    "SYNTAX",
    "- `name = expression`, one statement per line. Blank lines are fine.",
    "- Values: strings, numbers, booleans (`true` / `false`), `null`, lists `[...]`, objects `{ key: value }`.",
    "- Calls: `Component(arg1, arg2)` for components; `@Name(args)` for built-in functions and safe actions.",
    "- References: use a statement's name as a value. They may point forward to a later statement.",
    "- Member access: `row.file`; on a list it plucks that field from every item (`rows.file`). Indexing: `items[0]`.",
    "- Operators: `|| && == != > < >= <= + - * /`, unary `! -`, and `condition ? a : b`.",
    "- A trailing, still-open statement is treated as unfinished while streaming; a finished program must be complete.",
    "",
    "COMPONENTS (closed vocabulary)",
    componentSection(),
    "",
    "BUILT-IN FUNCTIONS",
    builtinSection(),
    "",
    "SAFE ACTIONS",
    actionSection(),
    "",
    "RULES",
    RULES.map((rule, index) => `${index + 1}. ${rule}`).join("\n"),
    "",
    "WORKED EXAMPLES",
    PONPOKO_UI_PROMPT_EXAMPLES.map((example, index) => `Example ${index + 1}:\n\`\`\`ponpoko-ui\n${example}\n\`\`\``).join(
      "\n\n",
    ),
  ].join("\n");
  return cached;
}

export function resetPonpokoUISystemPromptCache(): void {
  cached = null;
}
