import type { PonpokoUIPropType, PonpokoUIProp } from "./types";

export const str = (name: string, description: string, required = true): PonpokoUIProp => ({
  name,
  type: { kind: "string" },
  required,
  description,
});

export const num = (name: string, description: string, required = true): PonpokoUIProp => ({
  name,
  type: { kind: "number" },
  required,
  description,
});

export const bool = (name: string, description: string, required = true): PonpokoUIProp => ({
  name,
  type: { kind: "boolean" },
  required,
  description,
});

export const oneOf = (
  name: string,
  values: readonly string[],
  description: string,
  required = false,
): PonpokoUIProp => ({
  name,
  type: { kind: "enum", values },
  required,
  description,
});

export const elements = (name: string, description: string): PonpokoUIProp => ({
  name,
  type: { kind: "elements" },
  description,
});

export const prop = (
  name: string,
  type: PonpokoUIPropType,
  description: string,
  required = true,
): PonpokoUIProp => ({
  name,
  type,
  required,
  description,
});
