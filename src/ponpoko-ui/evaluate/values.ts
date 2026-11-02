import { isPonpokoUIAction, isPonpokoUIElement, isPonpokoUIObject, type PonpokoUIValue } from "../catalog";
import { MAX_ERRORS } from "./types";
import type { Ctx } from "./types";
import { evalExpr } from "./expr";

export function pushError(ctx: Ctx, message: string, index: number): void {
  if (ctx.errors.length >= MAX_ERRORS) return;
  ctx.errors.push({ message, index });
}

export function describeValue(value: PonpokoUIValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (isPonpokoUIElement(value)) return `the ${value.name} component`;
  if (isPonpokoUIAction(value)) return "an action";
  if (isPonpokoUIObject(value)) return "an object";
  if (typeof value === "string") return "a string";
  if (typeof value === "number") return "a number";
  return "a boolean";
}

export function truthy(value: PonpokoUIValue): boolean {
  if (value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

export function valuesEqual(left: PonpokoUIValue, right: PonpokoUIValue): boolean {
  if (left === right) return true;
  const leftComplex = typeof left === "object" || typeof right === "object";
  if (!leftComplex) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function clampString(ctx: Ctx, value: string, at: number): string {
  if (value.length <= ctx.caps.stringChars) return value;
  pushError(
    ctx,
    `a string is ${value.length} characters long; the limit is ${ctx.caps.stringChars} — it was shortened`,
    at,
  );
  return value.slice(0, ctx.caps.stringChars);
}

export function resolveRef(ctx: Ctx, name: string, at: number, depth: number): PonpokoUIValue | undefined {
  if (ctx.memo.has(name)) return ctx.memo.get(name);
  if (ctx.resolving.has(name)) {
    pushError(ctx, `'${name}' refers to itself — a reference cannot loop`, at);
    return undefined;
  }
  const statement = ctx.defs.get(name);
  if (!statement) {
    pushError(ctx, `unknown reference '${name}' — no statement defines it`, at);
    return undefined;
  }
  ctx.resolving.add(name);
  const value = evalExpr(ctx, statement.expr, depth + 1);
  ctx.resolving.delete(name);
  ctx.memo.set(name, value);
  return value;
}
