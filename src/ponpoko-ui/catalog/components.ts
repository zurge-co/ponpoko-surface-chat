import type { PonpokoUIComponent } from "./types";
import { str, num, bool, oneOf, elements, prop } from "./props";

export const PONPOKO_UI_COMPONENTS: readonly PonpokoUIComponent[] = [
  {
    name: "Card",
    description: "A bordered block with a title — the default container for a visual answer.",
    example: 'Card("Summary", [Text("All checks passed.")])',
    props: [
      str("title", "what the card is about"),
      elements("children", "the components inside the card"),
      str("footnote", "a small line under the content", false),
    ],
  },
  {
    name: "Row",
    description: "Places children side by side; they wrap when the column is narrow.",
    example: 'Row([Metric("Files", 4), Metric("Findings", 2)])',
    props: [
      elements("children", "the components in the row"),
      oneOf("align", ["start", "center", "end", "stretch"], "vertical alignment"),
      num("gap", "horizontal gap in Tailwind steps (default 3)", false),
    ],
  },
  {
    name: "Stack",
    description: "Places children in a vertical column with a consistent gap.",
    example: 'Stack([Heading("Plan", 3), Text("Three steps.")])',
    props: [elements("children", "the components in the stack"), num("gap", "vertical gap in Tailwind steps (default 3)", false)],
  },
  {
    name: "Grid",
    description: "A responsive grid of equally sized cells — good for metrics and small cards.",
    example: 'Grid([Badge("ok"), Badge("tests", "accent")], 2)',
    props: [
      elements("children", "the cells of the grid"),
      num("columns", "column count from 1 to 6 (default 2)", false),
    ],
  },
  {
    name: "Heading",
    description: "A section heading; level 1 is the largest and 6 the smallest.",
    example: 'Heading("Findings", 3)',
    props: [str("text", "the heading text"), num("level", "heading level 1–6 (default 3)", false)],
  },
  {
    name: "Text",
    description: "A paragraph of plain text.",
    example: 'Text("Nothing to report.", "muted")',
    props: [
      str("text", "the paragraph content"),
      oneOf("tone", ["default", "muted", "strong"], "visual weight"),
    ],
  },
  {
    name: "Badge",
    description: "A small status pill for a short label.",
    example: 'Badge("warning", "warn")',
    props: [
      str("label", "the short label"),
      oneOf("tone", ["neutral", "accent", "warn", "danger", "success"], "colour"),
    ],
  },
  {
    name: "Callout",
    description: "An emphasised note with a title — for warnings, risks or good news.",
    example: 'Callout("Careful", [Text("This rewrites the schema.")], "warn")',
    props: [
      str("title", "the note's title"),
      elements("children", "the note's content"),
      oneOf("tone", ["info", "warn", "danger", "success"], "colour"),
    ],
  },
  {
    name: "Metric",
    description: "One number that matters, with a label and an optional hint.",
    example: 'Metric("Findings", 3, "2 in src/a.ts")',
    props: [
      str("label", "what the number counts"),
      { name: "value", type: { kind: "value" }, description: "the number or short value" },
      str("hint", "a small line under the value", false),
      oneOf("tone", ["default", "accent", "warn", "danger"], "colour", false),
    ],
  },
  {
    name: "Facts",
    description: "A two-column definition list of label/value pairs.",
    example: 'Facts([["Path", "src/a.ts"], ["Lines", "42"]], "File")',
    props: [
      prop("pairs", { kind: "pairs" }, "label/value pairs"),
      str("title", "an optional title", false),
    ],
  },
  {
    name: "Table",
    description: "A real table: header cells and rows of text or numbers. Up to 500 rows.",
    example: 'Table(["File", "Issue"], [["src/a.ts", "unused import"]], "Findings")',
    props: [
      prop("columns", { kind: "strings" }, "the header cells"),
      prop("rows", { kind: "rows" }, "the body rows, each matching the header length"),
      str("caption", "an optional caption", false),
    ],
  },
  {
    name: "List",
    description: "A bulleted or numbered list of short strings.",
    example: 'List(["read the schema", "write the prompt table"], false, "Steps")',
    props: [
      prop("items", { kind: "strings" }, "the list items"),
      bool("ordered", "use numbers instead of bullets (default false)", false),
      str("title", "an optional title", false),
    ],
  },
  {
    name: "Code",
    description: "A syntax-highlighted code block with a language label and copy button.",
    example: 'Code("ts", "const x = 1;", "example.ts")',
    props: [
      str("language", "the language id (ts, rust, python, go, json, shell, sql, yaml, css, html, diff)"),
      str("code", "the exact code, already a string"),
      str("title", "an optional file name", false),
    ],
  },
  {
    name: "Patch",
    description: "A unified diff rendered with insert/delete colours — for proposed changes.",
    example: 'Patch("Fix the import", "--- a.ts\\n+++ b.ts\\n-import x\\n+import y")',
    props: [
      str("title", "what the patch does"),
      str("diff", "a unified diff as text"),
    ],
  },
  {
    name: "Steps",
    description: "An ordered list of steps with an optional detail line and a status.",
    example: 'Steps([{ title: "Read", status: "done" }, { title: "Write", detail: "v9", status: "doing" }], "Plan")',
    props: [
      prop(
        "steps",
        {
          kind: "records",
          fields: [
            { name: "title", type: "string", description: "the step" },
            { name: "detail", type: "string", required: false, description: "one line of explanation" },
            { name: "status", type: "enum", required: false, values: ["todo", "doing", "done", "blocked"], description: "progress" },
          ],
        },
        "the steps in order",
      ),
      str("title", "an optional title", false),
    ],
  },
  {
    name: "Progress",
    description: "A labelled progress bar with an explicit value and maximum.",
    example: 'Progress("Tests", 7, 10)',
    props: [
      str("label", "what is progressing"),
      num("value", "the current value"),
      num("max", "the maximum (default 100)", false),
    ],
  },
  {
    name: "Bars",
    description: "A bar chart of labelled values, drawn as inline SVG. Up to 200 bars.",
    example: 'Bars([{ label: "app", value: 12 }, { label: "core", value: 7 }], "Commits")',
    props: [
      prop(
        "data",
        {
          kind: "records",
          fields: [
            { name: "label", type: "string", description: "the bar's name" },
            { name: "value", type: "number", description: "the bar's height" },
          ],
        },
        "the bars",
      ),
      str("title", "an optional title", false),
    ],
  },
  {
    name: "Line",
    description: "A line chart of numbers, drawn as inline SVG. Up to 200 points.",
    example: 'Line([1, 4, 2, 8], ["Mon", "Tue", "Wed", "Thu"], "Latency")',
    props: [
      prop("points", { kind: "numbers" }, "the values in order"),
      prop("labels", { kind: "strings" }, "optional labels aligned with the points", false),
      str("title", "an optional title", false),
    ],
  },
  {
    name: "Sparkline",
    description: "A tiny inline trend line for one series of numbers. Up to 200 points.",
    example: 'Sparkline([3, 5, 4, 9, 7], "Requests")',
    props: [
      prop("points", { kind: "numbers" }, "the values in order"),
      str("label", "an accessible label", false),
    ],
  },
  {
    name: "Tabs",
    description: "Tabbed panels; the labels and the panels line up by index.",
    example: 'Tabs(["Summary", "Detail"], [[Text("Fast.")], [Text("p95 is 40ms.")]])',
    props: [
      prop("labels", { kind: "strings" }, "one label per panel"),
      prop("panels", { kind: "panels" }, "one component list per label"),
    ],
  },
  {
    name: "Accordion",
    description: "Collapsible sections; the titles and the panels line up by index.",
    example: 'Accordion(["Why", "How"], [[Text("It is safer.")], [Text("One schema file.")]])',
    props: [
      prop("titles", { kind: "strings" }, "one title per panel"),
      prop("panels", { kind: "panels" }, "one component list per title"),
    ],
  },
  {
    name: "Buttons",
    description: "A row of actions the human can press — the only interactive surface PonpokoUI has.",
    example: 'Buttons([Button("Ask", @Ask("Explain this")), Button("Copy", @Copy("text"))])',
    props: [prop("children", { kind: "buttons" }, "the buttons")],
  },
  {
    name: "Button",
    description: "One safe action: ask a follow-up, copy text, insert text, or open an http(s) link.",
    example: 'Button("Ask follow-up", @Ask("Why did this fail?"))',
    props: [
      str("label", "the button text"),
      prop("action", { kind: "action" }, "one of @Ask, @Copy, @Insert, @Open"),
      oneOf("variant", ["primary", "ghost", "danger"], "visual style"),
    ],
  },
  {
    name: "Divider",
    description: "A horizontal rule with breathing room.",
    example: "Divider()",
    props: [num("spacing", "vertical margin in Tailwind steps (default 3)", false)],
  },
];

export const PONPOKO_UI_COMPONENT_NAMES: readonly string[] = PONPOKO_UI_COMPONENTS.map((c) => c.name);

export const COMPONENT_BY_NAME = new Map(PONPOKO_UI_COMPONENTS.map((c) => [c.name, c]));

export function componentByName(name: string): PonpokoUIComponent | undefined {
  return COMPONENT_BY_NAME.get(name);
}
