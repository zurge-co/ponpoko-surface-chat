import { isPonpokoUIObject, type PonpokoUIObject, type PonpokoUIValue } from "../catalog";
import { type PonpokoUIExpr } from "../parser";
import type { Ctx } from "./types";
import { pushError, describeValue, truthy, valuesEqual, clampString, resolveRef } from "./values";
import { evalCall } from "./caps";
import { evalInvoke } from "./invoke";

export function evalExpr(ctx: Ctx, expr: PonpokoUIExpr, depth: number): PonpokoUIValue | undefined {
  if (depth > ctx.caps.depth) {
    if (!ctx.depthLimitHit) {
      ctx.depthLimitHit = true;
      pushError(ctx, `this program nests deeper than ${ctx.caps.depth} levels`, expr.at);
    }
    return undefined;
  }

  switch (expr.type) {
    case "literal":
      return typeof expr.value === "string" ? clampString(ctx, expr.value, expr.at) : expr.value;

    case "ref":
      return resolveRef(ctx, expr.name, expr.at, depth);

    case "array": {
      const items: PonpokoUIValue[] = [];
      for (const item of expr.items) {
        const value = evalExpr(ctx, item, depth + 1);
        if (value !== undefined) items.push(value);
      }
      return items;
    }

    case "object": {
      const object: PonpokoUIObject = {};
      for (const entry of expr.entries) {
        const value = evalExpr(ctx, entry.value, depth + 1);
        if (value !== undefined) object[entry.key] = value;
      }
      return object;
    }

    case "call":
      return evalCall(ctx, expr, depth);

    case "invoke":
      return evalInvoke(ctx, expr, depth);

    case "member": {
      const object = evalExpr(ctx, expr.object, depth + 1);
      if (object === undefined) return undefined;
      if (Array.isArray(object)) {
        const plucked: PonpokoUIValue[] = [];
        for (const item of object) {
          if (isPonpokoUIObject(item) && item[expr.prop] !== undefined) {
            const value = item[expr.prop]!;
            plucked.push(value);
          }
        }
        return plucked;
      }
      if (isPonpokoUIObject(object)) {
        const value = object[expr.prop];
        if (value === undefined) {
          pushError(ctx, `this object has no '${expr.prop}'`, expr.at);
          return undefined;
        }
        return value;
      }
      pushError(ctx, `cannot read '.${expr.prop}' from ${describeValue(object)}`, expr.at);
      return undefined;
    }

    case "index": {
      const object = evalExpr(ctx, expr.object, depth + 1);
      if (object === undefined) return undefined;
      const index = evalExpr(ctx, expr.index, depth + 1);
      if (index === undefined) return undefined;
      if (typeof index !== "number" || !Number.isInteger(index)) {
        pushError(ctx, `an index must be a whole number, but it is ${describeValue(index)}`, expr.at);
        return undefined;
      }
      if (typeof object === "string") {
        const char = object[index];
        if (char === undefined) {
          pushError(ctx, `index ${index} is outside a string of ${object.length} characters`, expr.at);
          return undefined;
        }
        return char;
      }
      if (Array.isArray(object)) {
        const value = object[index];
        if (value === undefined) {
          pushError(ctx, `index ${index} is outside a list of ${object.length} items`, expr.at);
          return undefined;
        }
        return value;
      }
      pushError(ctx, `cannot index ${describeValue(object)}`, expr.at);
      return undefined;
    }

    case "unary": {
      const operand = evalExpr(ctx, expr.operand, depth + 1);
      if (operand === undefined) return undefined;
      if (expr.op === "!") return !truthy(operand);
      if (typeof operand !== "number" || !Number.isFinite(operand)) {
        pushError(ctx, `'-' needs a number, but got ${describeValue(operand)}`, expr.at);
        return undefined;
      }
      return -operand;
    }

    case "binary":
      return evalBinary(ctx, expr, depth);

    case "ternary": {
      const test = evalExpr(ctx, expr.test, depth + 1);
      if (test === undefined) return undefined;
      return truthy(test)
        ? evalExpr(ctx, expr.then, depth + 1)
        : evalExpr(ctx, expr.otherwise, depth + 1);
    }
  }
}

export function evalBinary(
  ctx: Ctx,
  expr: Extract<PonpokoUIExpr, { type: "binary" }>,
  depth: number,
): PonpokoUIValue | undefined {
  const left = evalExpr(ctx, expr.left, depth + 1);
  if (left === undefined) return undefined;

  if (expr.op === "&&") {
    return truthy(left) ? evalExpr(ctx, expr.right, depth + 1) : left;
  }
  if (expr.op === "||") {
    return truthy(left) ? left : evalExpr(ctx, expr.right, depth + 1);
  }

  const right = evalExpr(ctx, expr.right, depth + 1);
  if (right === undefined) return undefined;

  switch (expr.op) {
    case "==":
      return valuesEqual(left, right);
    case "!=":
      return !valuesEqual(left, right);
    case ">":
    case "<":
    case ">=":
    case "<=": {
      if (typeof left === "number" && typeof right === "number") {
        if (expr.op === ">") return left > right;
        if (expr.op === "<") return left < right;
        if (expr.op === ">=") return left >= right;
        return left <= right;
      }
      if (typeof left === "string" && typeof right === "string") {
        if (expr.op === ">") return left > right;
        if (expr.op === "<") return left < right;
        if (expr.op === ">=") return left >= right;
        return left <= right;
      }
      pushError(
        ctx,
        `'${expr.op}' needs two numbers or two strings, but got ${describeValue(left)} and ${describeValue(right)}`,
        expr.at,
      );
      return undefined;
    }
    case "+": {
      if (typeof left === "number" && typeof right === "number") return left + right;
      if (typeof left === "string" || typeof right === "string") {
        const asText = (value: PonpokoUIValue): string | null => {
          if (typeof value === "string") return value;
          if (typeof value === "number" || typeof value === "boolean") return String(value);
          return null;
        };
        const leftText = asText(left);
        const rightText = asText(right);
        if (leftText !== null && rightText !== null) {
          return clampString(ctx, leftText + rightText, expr.at);
        }
      }
      pushError(
        ctx,
        `'+' needs two numbers or text, but got ${describeValue(left)} and ${describeValue(right)}`,
        expr.at,
      );
      return undefined;
    }
    case "-":
    case "*":
    case "/": {
      if (
        typeof left !== "number" ||
        typeof right !== "number" ||
        !Number.isFinite(left) ||
        !Number.isFinite(right)
      ) {
        pushError(
          ctx,
          `'${expr.op}' needs two numbers, but got ${describeValue(left)} and ${describeValue(right)}`,
          expr.at,
        );
        return undefined;
      }
      if (expr.op === "-") return left - right;
      if (expr.op === "*") return left * right;
      if (right === 0) {
        pushError(ctx, "dividing by zero has no answer", expr.at);
        return undefined;
      }
      return left / right;
    }
  }
}
