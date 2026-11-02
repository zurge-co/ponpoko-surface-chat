import type { PonpokoUIField, PonpokoUIPropType, PonpokoUIProp, PonpokoUIComponent } from "./types";

export function fieldType(field: PonpokoUIField): string {
  if (field.type === "number") return "number";
  if (field.type === "enum") return (field.values ?? []).map((v) => `"${v}"`).join(" | ");
  return "string";
}

export function propTypeName(type: PonpokoUIPropType): string {
  switch (type.kind) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "value":
      return "string | number";
    case "enum":
      return type.values.map((v) => `"${v}"`).join(" | ");
    case "action":
      return "Action";
    case "elements":
      return "Component[]";
    case "buttons":
      return "Button[]";
    case "panels":
      return "Component[][]";
    case "strings":
      return "string[]";
    case "numbers":
      return "number[]";
    case "pairs":
      return "[string, string][]";
    case "rows":
      return "(string | number)[][]";
    case "records":
      return `{${type.fields
        .map((f) => `${f.name}${f.required === false ? "?" : ""}: ${fieldType(f)}`)
        .join(", ")}}[]`;
  }
}

export function isRequired(prop: PonpokoUIProp): boolean {
  return prop.required !== false;
}

export function componentSignature(component: PonpokoUIComponent): string {
  const args = component.props
    .map((p) => `${p.name}${isRequired(p) ? "" : "?"}: ${propTypeName(p.type)}`)
    .join(", ");
  return `${component.name}(${args})`;
}

export function requiredArgumentCount(component: PonpokoUIComponent): number {
  return component.props.filter(isRequired).length;
}
