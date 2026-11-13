import aiContract from "../ai-contract.json";
import { readFile } from "node:fs/promises";
import type { Row } from "./store";

export type Runtime = (operation: string, payload?: Row) => Promise<any>;

export function hostRuntime(control: string, surfaceId: string): Runtime {
  return async (operation, payload = {}) => {
    const endpoint = JSON.parse(await readFile(control, "utf8"));
    const url = new URL(endpoint.url);
    if (endpoint.protocol !== 1 || url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Invalid Host runtime endpoint");
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.token}` },
      body: JSON.stringify({ protocol: 1, verb: "runtime", surface_id: surfaceId, extra: { operation, ...(["slots","usage","start","validate","invoke"].includes(operation) || operation.startsWith("invoke_") ? { contract_version: aiContract.contract_version } : {}), ...payload } }),
      signal: AbortSignal.timeout(25_000),
    });
    const answer = await response.json() as Row;
    if (!response.ok || !answer.ok) throw new Error(answer.error ?? answer.message ?? "Host runtime unavailable");
    return answer.snapshot;
  };
}
