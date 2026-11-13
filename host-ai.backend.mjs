import { readFile } from "node:fs/promises";
import { createHostAi, CONTRACT } from "./host-ai.mjs";

export function createBackendAi({ control = process.env.PONPOKO_HOST_CONTROL, surfaceId = process.env.PONPOKO_SURFACE_ID } = {}) {
  let confirmed = "";
  async function transport(payload) {
    if (!control || !surfaceId) throw Object.assign(new Error("The Host AI backend environment is missing."), { code: "host_unavailable" });
    const endpoint = JSON.parse(await readFile(control, "utf8"));
    const url = new URL(endpoint.url);
    if (endpoint.protocol !== 1 || url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.search || url.hash || typeof endpoint.token !== "string" || !endpoint.token) throw Object.assign(new Error("Invalid Host control endpoint."), { code: "invalid_input" });
    async function send(extra) {
      let response;
      try { response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.token}` }, body: JSON.stringify({ protocol: 1, verb: "runtime", surface_id: surfaceId, extra }), signal: AbortSignal.timeout(65000) }); }
      catch { throw Object.assign(new Error("The Host response was not confirmed. Inspect the original request ID before retrying."), { code: ["invoke", "invoke_job_cancel"].includes(extra.operation) ? "unknown_outcome" : "host_unavailable" }); }
      let answer;
      try { answer = await response.json(); } catch { throw Object.assign(new Error("The Host response was unreadable. Inspect the original request before retrying."), { code: ["invoke", "invoke_job_cancel"].includes(extra.operation) ? "unknown_outcome" : "host_unavailable" }); }
      if (!response.ok || answer.ok !== true) {
        const message = typeof answer.error === "string" ? answer.error : answer.error?.message ?? answer.message ?? "Host AI request failed.";
        const prefix = message.split(":")[0];
        throw Object.assign(new Error(message), { code: answer.error?.code ?? (/^[a-z_]+$/.test(prefix) ? prefix : "host_unavailable") });
      }
      return answer.snapshot;
    }
    if (payload.operation !== "contract" && confirmed !== endpoint.token) {
      const descriptor = await send({ operation: "contract" });
      if (descriptor.version !== CONTRACT.version || descriptor.schema_sha256 !== CONTRACT.schema_sha256) throw Object.assign(new Error("This surface needs the running Host AI contract assets."), { code: "ai_contract_mismatch" });
      confirmed = endpoint.token;
    }
    return send(payload);
  }
  return createHostAi(transport);
}
