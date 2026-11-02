export type PonpokoUIActionName = "ask" | "copy" | "insert" | "open";

export interface PonpokoUIAction {
  kind: "action";
  name: PonpokoUIActionName;
  value: string;
}

export interface PonpokoUIElement {
  kind: "element";
  name: string;
  props: Record<string, PonpokoUIValue>;
}

export interface PonpokoUIObject {
  [key: string]: PonpokoUIValue;
}

export type PonpokoUIValue =
  | string
  | number
  | boolean
  | null
  | PonpokoUIValue[]
  | PonpokoUIObject
  | PonpokoUIElement
  | PonpokoUIAction;

export function isPonpokoUIElement(value: unknown): value is PonpokoUIElement {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "element"
  );
}

export function isPonpokoUIAction(value: unknown): value is PonpokoUIAction {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "action"
  );
}

export function isPonpokoUIObject(value: unknown): value is PonpokoUIObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isPonpokoUIElement(value) &&
    !isPonpokoUIAction(value)
  );
}


export interface PonpokoUIEnumOption {
  value: string;
  hint: string;
}

export interface PonpokoUIField {
  name: string;
  type: "string" | "number" | "enum";
  required?: boolean;
  values?: readonly string[];
  description: string;
}

export type PonpokoUIPropType =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "value" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "action" }
  | { kind: "elements" }
  | { kind: "buttons" }
  | { kind: "panels" }
  | { kind: "strings" }
  | { kind: "numbers" }
  | { kind: "pairs" }
  | { kind: "rows" }
  | { kind: "records"; fields: readonly PonpokoUIField[] };

export interface PonpokoUIProp {
  name: string;
  type: PonpokoUIPropType;
  required?: boolean;
  description: string;
}

export interface PonpokoUIComponent {
  name: string;
  description: string;
  example: string;
  props: readonly PonpokoUIProp[];
}

export interface PonpokoUIBuiltin {
  name: string;
  signature: string;
  description: string;
  example: string;
}

export interface PonpokoUIActionDef {
  name: PonpokoUIActionName;
  signature: string;
  description: string;
  example: string;
}


export interface PonpokoUICaps {
  programChars: number;
  depth: number;
  nodes: number;
  stringChars: number;
  tableRows: number;
  chartPoints: number;
}

export const PONPOKO_UI_CAPS: PonpokoUICaps = {
  programChars: 100_000,
  depth: 32,
  nodes: 2_000,
  stringChars: 20_000,
  tableRows: 500,
  chartPoints: 200,
};
