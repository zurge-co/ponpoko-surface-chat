import { createInterface } from "node:readline";
import { ChatStore } from "./store";
import { ChatBackend } from "./app";
import { hostRuntime } from "./runtime";

const directory = process.env.PONPOKO_SURFACE_DATA_DIR;
const control = process.env.PONPOKO_HOST_CONTROL;
const id = process.env.PONPOKO_SURFACE_ID;
if (!directory || !control || !id) throw new Error("The Host must provide surface storage and runtime connection");
const store = new ChatStore(directory, process.env.PONPOKO_HOST_DATABASE);
const app = new ChatBackend(store, hostRuntime(control, id));
app.turns.recover();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  let request;
  try {
    if (Buffer.byteLength(line) > 8 * 1024 * 1024) throw new Error("Request exceeds 8 MiB");
    request = JSON.parse(line);
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string" || request.id === undefined) throw new Error("Invalid JSON-RPC request");
    const result = await app.call(request.method, request.params ?? {});
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32000, message: String(error) } }) + "\n");
  }
}
store.db.close();
process.exit(0);
