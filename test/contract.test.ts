import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { SCHEMA, CONTRACT, validateSchema } from "../host-ai.mjs";

const json = (name: string) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));

test("vendored Host schema and representative requests agree with the declared contract", () => {
  expect(json("surface.json").requires.ai).toBe(CONTRACT.version);
  expect(json("ai-contract.json")).toEqual(SCHEMA);
  expect(createHash("sha256").update(readFileSync(new URL("../ai-contract.json", import.meta.url))).digest("hex")).toBe(CONTRACT.schema_sha256);
  const requests = json("ai-requests.json");
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) expect(() => validateSchema(SCHEMA, SCHEMA.$defs.InferenceRequest, request)).not.toThrow();
  expect(() => validateSchema(SCHEMA, SCHEMA.$defs.InferenceRequest, { ...requests[0], provider: "undeclared" })).toThrow();
});
