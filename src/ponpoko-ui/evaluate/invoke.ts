import { actionByName, builtinByName, isSafeOpenUrl, type PonpokoUIAction, type PonpokoUIActionName, type PonpokoUIValue } from "../catalog";
import { type PonpokoUIExpr } from "../parser";
import type { Ctx } from "./types";
import { pushError, describeValue, clampString } from "./values";
import { evalExpr } from "./expr";

export function numericList(ctx: Ctx, name: string, value: PonpokoUIValue | undefined, at: number): number[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    pushError(
      ctx,
      `@${name} expects number[], but got ${value === undefined ? "nothing" : describeValue(value)}`,
      at,
    );
    return null;
  }
  return value as number[];
}

export function evalInvoke(
  ctx: Ctx,
  expr: Extract<PonpokoUIExpr, { type: "invoke" }>,
  depth: number,
): PonpokoUIValue | undefined {
  const builtin = builtinByName(expr.name);
  if (builtin) return evalBuiltin(ctx, expr, builtin.name, depth);

  const action = actionByName(expr.name.toLowerCase());
  if (action) return evalAction(ctx, expr, action.name, depth);

  pushError(
    ctx,
    `unknown function or action '@${expr.name}' — built-ins are @Count, @Sum, @Avg, @Percent, @Join; actions are @Ask, @Copy, @Insert, @Open`,
    expr.at,
  );
  return undefined;
}

export function evalBuiltin(
  ctx: Ctx,
  expr: Extract<PonpokoUIExpr, { type: "invoke" }>,
  name: string,
  depth: number,
): PonpokoUIValue | undefined {
  const args: (PonpokoUIValue | undefined)[] = [];
  for (const arg of expr.args) args.push(evalExpr(ctx, arg, depth + 1));
  if (args.some((arg) => arg === undefined)) return undefined;

  const expectedArgs = name === "Join" ? [1, 2] : name === "Percent" ? [2, 2] : [1, 1];
  if (args.length < expectedArgs[0]! || args.length > expectedArgs[1]!) {
    pushError(
      ctx,
      `@${name} takes ${expectedArgs[0] === expectedArgs[1] ? expectedArgs[0] : `${expectedArgs[0]} or ${expectedArgs[1]}`} argument${
        expectedArgs[1] === 1 ? "" : "s"
      }, but got ${args.length}`,
      expr.at,
    );
    return undefined;
  }

  switch (name) {
    case "Count": {
      const value = args[0]!;
      if (Array.isArray(value)) return value.length;
      if (typeof value === "string") return value.length;
      pushError(ctx, `@Count expects a list, but got ${describeValue(value)}`, expr.at);
      return undefined;
    }
    case "Sum": {
      const values = numericList(ctx, name, args[0], expr.at);
      if (!values) return undefined;
      return values.reduce((total, value) => total + value, 0);
    }
    case "Avg": {
      const values = numericList(ctx, name, args[0], expr.at);
      if (!values) return undefined;
      if (values.length === 0) {
        pushError(ctx, "@Avg needs at least one value", expr.at);
        return undefined;
      }
      return values.reduce((total, value) => total + value, 0) / values.length;
    }
    case "Percent": {
      const [value, total] = args;
      if (
        typeof value !== "number" ||
        typeof total !== "number" ||
        !Number.isFinite(value) ||
        !Number.isFinite(total)
      ) {
        pushError(ctx, "@Percent expects two numbers", expr.at);
        return undefined;
      }
      if (total === 0) {
        pushError(ctx, "@Percent needs a total above zero", expr.at);
        return undefined;
      }
      return `${Math.round((value / total) * 100)}%`;
    }
    case "Join": {
      const value = args[0]!;
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        pushError(ctx, `@Join expects string[], but got ${describeValue(value)}`, expr.at);
        return undefined;
      }
      const separator = args[1];
      if (separator !== undefined && typeof separator !== "string") {
        pushError(ctx, "@Join's separator must be a string", expr.at);
        return undefined;
      }
      return clampString(ctx, value.join(separator ?? ", "), expr.at);
    }
    default:
      pushError(ctx, `unknown function '@${name}'`, expr.at);
      return undefined;
  }
}

export function evalAction(
  ctx: Ctx,
  expr: Extract<PonpokoUIExpr, { type: "invoke" }>,
  name: PonpokoUIActionName,
  depth: number,
): PonpokoUIValue | undefined {
  if (expr.args.length !== 1) {
    pushError(ctx, `@${name} takes one argument, but got ${expr.args.length}`, expr.at);
    return undefined;
  }
  const value = evalExpr(ctx, expr.args[0]!, depth + 1);
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    pushError(ctx, `@${name} expects a string, but got ${describeValue(value)}`, expr.at);
    return undefined;
  }
  if (name === "open" && !isSafeOpenUrl(value)) {
    pushError(ctx, `@Open only opens http:// or https:// links — "${value}" was refused`, expr.at);
    return undefined;
  }
  const action: PonpokoUIAction = { kind: "action", name, value };
  return action;
}
