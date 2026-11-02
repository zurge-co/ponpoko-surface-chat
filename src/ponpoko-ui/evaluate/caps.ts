import { componentByName, isRequired, isPonpokoUIAction, isPonpokoUIElement, isPonpokoUIObject, propTypeName, requiredArgumentCount, type PonpokoUIComponent, type PonpokoUIField, type PonpokoUIObject, type PonpokoUIProp, type PonpokoUIValue } from "../catalog";
import { type PonpokoUIExpr } from "../parser";
import type { Ctx } from "./types";
import { pushError, describeValue } from "./values";
import { evalExpr } from "./expr";

export function arityText(component: PonpokoUIComponent): string {
  const required = requiredArgumentCount(component);
  const total = component.props.length;
  if (required === total) return `${total} argument${total === 1 ? "" : "s"}`;
  return `${required} to ${total} arguments`;
}

export function evalCall(
  ctx: Ctx,
  expr: Extract<PonpokoUIExpr, { type: "call" }>,
  depth: number,
): PonpokoUIValue | undefined {
  const component = componentByName(expr.name);
  if (!component) {
    pushError(
      ctx,
      `unknown component '${expr.name}' — PonpokoUI is a closed set; the system prompt lists every component`,
      expr.at,
    );
    return undefined;
  }

  const required = requiredArgumentCount(component);
  if (expr.args.length < required || expr.args.length > component.props.length) {
    pushError(
      ctx,
      `${component.name} expects ${arityText(component)}, but got ${expr.args.length}`,
      expr.at,
    );
  }

  const props: Record<string, PonpokoUIValue> = {};
  let missingRequired = false;
  for (let i = 0; i < component.props.length; i += 1) {
    const prop = component.props[i]!;
    const arg = expr.args[i];
    if (!arg) {
      if (isRequired(prop)) missingRequired = true;
      continue;
    }
    const value = evalExpr(ctx, arg, depth + 1);
    if (value === undefined) {
      if (isRequired(prop)) missingRequired = true;
      continue;
    }
    const validated = validateProp(ctx, component, prop, i, value, arg.at);
    if (validated === undefined) {
      if (isRequired(prop)) missingRequired = true;
      continue;
    }
    props[prop.name] = validated;
  }

  if (missingRequired) return undefined;

  applyDataCaps(ctx, component, props, expr.at);

  ctx.nodes += 1;
  if (ctx.nodes > ctx.caps.nodes) {
    if (!ctx.nodeLimitHit) {
      ctx.nodeLimitHit = true;
      pushError(
        ctx,
        `this program renders more than ${ctx.caps.nodes} components — the rest was dropped`,
        expr.at,
      );
    }
    return undefined;
  }

  return { kind: "element", name: component.name, props };
}

export function applyDataCaps(
  ctx: Ctx,
  component: PonpokoUIComponent,
  props: Record<string, PonpokoUIValue>,
  at: number,
): void {
  switch (component.name) {
    case "Table": {
      const rows = props.rows;
      if (Array.isArray(rows)) {
        const columns = props.columns;
        if (Array.isArray(columns)) {
          const mismatched = rows.findIndex(
            (row) => Array.isArray(row) && row.length !== columns.length,
          );
          if (mismatched >= 0) {
            pushError(
              ctx,
              `Table row ${mismatched + 1} has ${
                Array.isArray(rows[mismatched]) ? (rows[mismatched] as PonpokoUIValue[]).length : 0
              } cells, but there are ${columns.length} column headers`,
              at,
            );
          }
        }
        if (rows.length > ctx.caps.tableRows) {
          pushError(
            ctx,
            `Table has ${rows.length} rows; only the first ${ctx.caps.tableRows} are shown`,
            at,
          );
          props.rows = rows.slice(0, ctx.caps.tableRows);
        }
      }
      break;
    }
    case "Bars": {
      const data = props.data;
      if (Array.isArray(data) && data.length > ctx.caps.chartPoints) {
        pushError(ctx, `Bars has ${data.length} bars; only the first ${ctx.caps.chartPoints} are shown`, at);
        props.data = data.slice(0, ctx.caps.chartPoints);
      }
      break;
    }
    case "Line":
    case "Sparkline": {
      const points = props.points;
      if (Array.isArray(points) && points.length > ctx.caps.chartPoints) {
        pushError(
          ctx,
          `${component.name} has ${points.length} points; only the first ${ctx.caps.chartPoints} are shown`,
          at,
        );
        props.points = points.slice(0, ctx.caps.chartPoints);
      }
      break;
    }
    case "Tabs":
    case "Accordion": {
      const listName = component.name === "Tabs" ? "labels" : "titles";
      const list = props[listName];
      const panels = props.panels;
      if (Array.isArray(list) && Array.isArray(panels) && list.length !== panels.length) {
        pushError(
          ctx,
          `${component.name} needs one panel per entry — ${list.length} ${
            component.name === "Tabs" ? "labels" : "titles"
          }, ${panels.length} panels`,
          at,
        );
      }
      break;
    }
    default:
      break;
  }
}


export function validateElements(
  ctx: Ctx,
  value: PonpokoUIValue,
  label: string,
  only: string | null,
  at: number,
): PonpokoUIValue | undefined {
  if (!Array.isArray(value)) {
    pushError(ctx, `${label} expects ${only ?? "Component"}[], but got ${describeValue(value)}`, at);
    return undefined;
  }
  const accepted: PonpokoUIValue[] = [];
  for (const item of value) {
    if (!isPonpokoUIElement(item)) {
      pushError(ctx, `${label} expects components, but one item is ${describeValue(item)}`, at);
      continue;
    }
    if (only !== null && item.name !== only) {
      pushError(ctx, `${label} only accepts ${only} components, but got ${item.name}`, at);
      continue;
    }
    accepted.push(item);
  }
  return accepted;
}

export function validateRecordField(
  ctx: Ctx,
  label: string,
  record: PonpokoUIObject,
  field: PonpokoUIField,
  at: number,
): boolean {
  const value = record[field.name];
  if (value === undefined) {
    if (field.required === false) return true;
    pushError(ctx, `${label} needs a '${field.name}' ${field.type}`, at);
    return false;
  }
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      pushError(ctx, `${label} field '${field.name}' expects number, but got ${describeValue(value)}`, at);
      return false;
    }
    return true;
  }
  if (typeof value !== "string") {
    pushError(ctx, `${label} field '${field.name}' expects string, but got ${describeValue(value)}`, at);
    return false;
  }
  if (field.values && !field.values.includes(value)) {
    pushError(
      ctx,
      `${label} field '${field.name}' expects ${field.values.map((v) => `"${v}"`).join(" | ")}, but got "${value}"`,
      at,
    );
    return false;
  }
  return true;
}

export function validateProp(
  ctx: Ctx,
  component: PonpokoUIComponent,
  prop: PonpokoUIProp,
  index: number,
  value: PonpokoUIValue,
  at: number,
): PonpokoUIValue | undefined {
  const label = `${component.name} argument ${index + 1} (${prop.name})`;
  const expected = propTypeName(prop.type);
  const wrong = (): undefined => {
    pushError(ctx, `${label} expects ${expected}, but got ${describeValue(value)}`, at);
    return undefined;
  };

  switch (prop.type.kind) {
    case "string":
      return typeof value === "string" ? value : wrong();
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : wrong();
    case "boolean":
      return typeof value === "boolean" ? value : wrong();
    case "value":
      return typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value))
        ? value
        : wrong();
    case "enum":
      if (typeof value !== "string") return wrong();
      if (!prop.type.values.includes(value)) {
        pushError(
          ctx,
          `${label} expects ${prop.type.values.map((v) => `"${v}"`).join(" | ")}, but got "${value}"`,
          at,
        );
        return undefined;
      }
      return value;
    case "action":
      return isPonpokoUIAction(value) ? value : wrong();
    case "elements":
      return validateElements(ctx, value, label, null, at);
    case "buttons":
      return validateElements(ctx, value, label, "Button", at);
    case "panels": {
      if (!Array.isArray(value)) return wrong();
      const panels: PonpokoUIValue[] = [];
      for (const panel of value) {
        if (!Array.isArray(panel)) {
          pushError(ctx, `${label} expects a list of component lists`, at);
          continue;
        }
        const validated = validateElements(ctx, panel, label, null, at);
        if (validated !== undefined) panels.push(validated);
      }
      return panels;
    }
    case "strings": {
      if (!Array.isArray(value)) return wrong();
      const strings: PonpokoUIValue[] = [];
      for (const item of value) {
        if (typeof item === "string") strings.push(item);
        else pushError(ctx, `${label} expects strings, but one item is ${describeValue(item)}`, at);
      }
      return strings;
    }
    case "numbers": {
      if (!Array.isArray(value)) return wrong();
      const numbers: PonpokoUIValue[] = [];
      for (const item of value) {
        if (typeof item === "number" && Number.isFinite(item)) numbers.push(item);
        else pushError(ctx, `${label} expects numbers, but one item is ${describeValue(item)}`, at);
      }
      return numbers;
    }
    case "pairs": {
      if (!Array.isArray(value)) return wrong();
      const pairs: PonpokoUIValue[] = [];
      for (const item of value) {
        if (!Array.isArray(item) || item.length < 2) {
          pushError(ctx, `${label} expects [string, string] pairs`, at);
          continue;
        }
        const [first, second] = item;
        if (typeof first !== "string" || typeof second !== "string") {
          pushError(ctx, `${label} expects [string, string] pairs`, at);
          continue;
        }
        pairs.push([first, second]);
      }
      return pairs;
    }
    case "rows": {
      if (!Array.isArray(value)) return wrong();
      const rows: PonpokoUIValue[] = [];
      for (const row of value) {
        if (!Array.isArray(row)) {
          pushError(ctx, `${label} expects rows of cells`, at);
          continue;
        }
        const cells: PonpokoUIValue[] = [];
        let bad = false;
        for (const cell of row) {
          if (typeof cell === "string" || (typeof cell === "number" && Number.isFinite(cell))) {
            cells.push(cell);
          } else {
            bad = true;
          }
        }
        if (bad) {
          pushError(ctx, `${label} expects text or number cells`, at);
          continue;
        }
        rows.push(cells);
      }
      return rows;
    }
    case "records": {
      if (!Array.isArray(value)) return wrong();
      const records: PonpokoUIValue[] = [];
      for (const item of value) {
        if (!isPonpokoUIObject(item)) {
          pushError(ctx, `${label} expects objects, but one item is ${describeValue(item)}`, at);
          continue;
        }
        let ok = true;
        for (const field of prop.type.fields) {
          if (!validateRecordField(ctx, label, item, field, at)) ok = false;
        }
        if (ok) records.push(item);
      }
      return records;
    }
  }
}
