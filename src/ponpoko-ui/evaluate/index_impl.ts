import { PONPOKO_UI_CAPS, isPonpokoUIElement, type PonpokoUICaps, type PonpokoUIElement } from "../catalog";
import type { PonpokoUIError } from "../lexer";
import { parsePonpokoUI, type PonpokoUIStatement } from "../parser";
import type { PonpokoUIEvalOptions, EvaluatedPonpokoUI, Ctx } from "./types";
import { pushError, describeValue } from "./values";
import { evalExpr } from "./expr";

export function evaluatePonpokoUI(parsed: ReturnType<typeof parsePonpokoUI>, options?: PonpokoUIEvalOptions): EvaluatedPonpokoUI {
  const caps: PonpokoUICaps = { ...PONPOKO_UI_CAPS, ...(options?.caps ?? {}) };
  const errors: PonpokoUIError[] = [...parsed.errors];

  if (parsed.program.length > caps.programChars) {
    errors.push({
      message: `this program is ${parsed.program.length} characters; the limit is ${caps.programChars} — it was not rendered`,
      index: 0,
    });
    return { tree: null, errors, incomplete: parsed.incomplete, nodes: 0 };
  }

  const defs = new Map<string, PonpokoUIStatement>();
  for (const statement of parsed.program.statements) {
    if (defs.has(statement.name)) {
      errors.push({
        message: `'${statement.name}' is defined more than once — the first definition wins`,
        index: statement.at,
      });
      continue;
    }
    defs.set(statement.name, statement);
  }

  const root = defs.get("root");
  if (!root) {
    if (!parsed.incomplete) {
      errors.push({
        message: "a PonpokoUI program ends with `root = ...` — this one has no root statement",
        index: parsed.program.length,
      });
    }
    return { tree: null, errors, incomplete: parsed.incomplete, nodes: 0 };
  }

  const ctx: Ctx = {
    defs,
    memo: new Map(),
    resolving: new Set(["root"]),
    errors,
    caps,
    nodes: 0,
    nodeLimitHit: false,
    depthLimitHit: false,
  };

  const value = evalExpr(ctx, root.expr, 0);
  ctx.resolving.delete("root");

  let tree: PonpokoUIElement | null = null;
  if (value === undefined) {
    tree = null;
  } else if (!isPonpokoUIElement(value)) {
    pushError(
      ctx,
      `root must be a component call, but it is ${describeValue(value)}`,
      root.at,
    );
  } else {
    tree = value;
  }

  return { tree, errors: ctx.errors, incomplete: parsed.incomplete, nodes: ctx.nodes };
}

export function compilePonpokoUI(source: string, options?: PonpokoUIEvalOptions): EvaluatedPonpokoUI {
  return evaluatePonpokoUI(parsePonpokoUI(source), options);
}
