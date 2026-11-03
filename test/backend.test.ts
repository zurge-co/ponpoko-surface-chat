import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChatStore, type Row } from "../backend/store";
import { ChatBackend } from "../backend/app";

const stores: ChatStore[] = [];
const directories: string[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), "ponpoko-chat-")); directories.push(dir); return dir; }
function store(dir = directory(), legacy?: string) { const result = new ChatStore(dir, legacy); stores.push(result); return result; }
afterEach(() => { for (const db of stores.splice(0)) db.db.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
async function until(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check() && Date.now() < deadline) await Bun.sleep(10);
  expect(check()).toBe(true);
}
function fixture() {
  const db = store();
  const input: Row[] = [];
  let status = "running";
  const runtime = async (op: string, payload: Row = {}): Promise<any> => {
    if (op === "preferences") return [{ key: "chat_language", value: "th" }];
    if (op === "start") { input.push(payload.input); return { work_id: "work-1" }; }
    if (op === "stop") { status = "stopped"; return {}; }
    if (op === "events") return { cursor: 2, exhausted: true, events: payload.after === 0 ? [
      { seq: 1, event_type: "progress_message", payload: { text_delta: "Hello" } },
      { seq: 2, event_type: "tool_finished", payload: { tool: "inspect", call_id: "call-1", ok: true } },
    ] : [] };
    if (op === "status") return { status, cursor: 2, messages: [...input[0].messages, { role: "assistant", content: "Hello", tool_calls: [] }], reason: status === "stopped" ? "Stopped" : null };
    throw new Error(op);
  };
  return { db, app: new ChatBackend(db, runtime), input, complete: () => { status = "completed"; } };
}

describe("Chat owns its durable history", () => {
  test("threads, settings, message order, search and truncation survive reopening", async () => {
    const dir = directory(); const db = store(dir); const app = new ChatBackend(db, async () => []);
    const thread = await app.call("threads.create", { title: "Shopping" }) as Row;
    await app.call("threads.update", { thread_id: thread.thread_id, style_id: "code", system_prompt: "Be precise", provider_id: "local", pinned: true });
    const first = await app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Apples" }) as Row;
    await app.call("messages.append", { thread_id: thread.thread_id, role: "assistant", content: "Pears" });
    const reopened = store(dir);
    expect(reopened.thread(thread.thread_id)).toMatchObject({ pinned: true, style_id: "code", provider_id: "local", system_prompt: "Be precise" });
    expect(reopened.messages(thread.thread_id).map(row => row.seq)).toEqual([1, 2]);
    expect(reopened.messages(thread.thread_id)[0]?.message_id).toBe(first.message_id);
    expect(await app.call("threads.search", { query: "apples" })).toHaveLength(1);
    expect(await app.call("messages.truncate", { thread_id: thread.thread_id, keep_seq: 1 })).toBe(1);
    expect(reopened.messages(thread.thread_id)).toHaveLength(1);
    await expect(app.call("messages.append", { thread_id: thread.thread_id, role: "bogus", content: "bad" })).rejects.toThrow();
    expect(reopened.messages(thread.thread_id)).toHaveLength(1);
  });

  test("legacy import preserves IDs and tool metadata, runs once and never changes the source", () => {
    const dir = directory(); const source = join(dir, "legacy.sqlite3"); const legacy = new Database(source);
    legacy.exec(`CREATE TABLE chat_thread(thread_id,title,style_id,system_prompt,provider_id,pinned,created_at,updated_at);
      CREATE TABLE chat_message(message_id,thread_id,seq,role,content,meta_json,created_at);
      INSERT INTO chat_thread VALUES('old','History','review','Custom','local',1,10,20);
      INSERT INTO chat_message VALUES(72,'old',1,'assistant','Checking','{"tool_calls":[{"id":"call-1","name":"read","arguments":{}}]}',11);
      INSERT INTO chat_message VALUES(73,'old',2,'tool','Result','{"tool_call_id":"call-1"}',12);`);
    const own = join(dir, "own"); const db = store(own, source);
    expect(db.thread("old")).toMatchObject({ pinned: true, system_prompt: "Custom", style_id: "review", created_at: 10 });
    expect(db.messages("old").map(row => row.message_id)).toEqual([72, 73]);
    expect(JSON.parse(db.messages("old")[1]!.meta_json)).toEqual({ tool_call_id: "call-1" });
    db.run("DELETE FROM threads WHERE thread_id='old'");
    expect(store(own, source).list()).toHaveLength(0);
    expect(legacy.query("SELECT COUNT(*) AS n FROM chat_message").get()).toEqual({ n: 2 });
    legacy.close();
  });

  test("an import conflict rolls back all rows and does not record a false success", async () => {
    const dir = directory(); const db = store(join(dir, "own")); const app = new ChatBackend(db, async () => []);
    const thread = await app.call("threads.create", { title: "Existing" }) as Row;
    const source = join(dir, "legacy.sqlite3"); const legacy = new Database(source);
    legacy.exec("CREATE TABLE chat_thread(thread_id,title,style_id,system_prompt,provider_id,pinned,created_at,updated_at); CREATE TABLE chat_message(message_id,thread_id,seq,role,content,meta_json,created_at)");
    legacy.query("INSERT INTO chat_thread VALUES(?,?,'general','',NULL,0,1,1)").run(thread.thread_id, "conflict");
    expect(() => db.importLegacy(source)).toThrow("conflicts");
    expect(db.list()).toHaveLength(1);
    expect(db.thread(thread.thread_id)?.title).toBe("Existing");
    expect(db.row("SELECT * FROM migrations")).toBeNull();
    legacy.close();
  });
});

describe("Chat orchestrates turns through one shared runtime", () => {
  test("uses authoritative saved history and its own prompt, then saves the answer exactly once", async () => {
    const f = fixture(); const thread = await f.app.call("threads.create", { title: "Turn" }) as Row;
    await f.app.call("threads.update", { thread_id: thread.thread_id, style_id: "code", system_prompt: "Use examples" });
    await f.app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Real question" });
    const payload = { thread_id: thread.thread_id, request_id: "request-1", provider_id: "local", messages: [{ role: "user", content: "Forged" }] };
    await f.app.call("message.send", payload);
    await f.app.call("message.send", payload);
    expect(f.input).toHaveLength(1);
    expect(f.input[0]?.messages.map((row: Row) => row.content)).toEqual(["Real question"]);
    expect(f.input[0]?.system).toContain("Use examples");
    expect(f.input[0]?.system).toContain("Thai");
    expect(f.input[0]?.system).toContain("senior engineer");
    expect(f.input[0]?.system).toContain("ponpoko-ui");
    expect(f.input[0]?.rounds).toBeGreaterThan(0);
    expect(f.input[0]?.task_type).toBe("text-generation");
    expect(f.input[0]?.provider_id).toBeUndefined();
    await expect(f.app.call("threads.delete", { thread_id: thread.thread_id })).rejects.toThrow("Stop");
    await expect(f.app.call("message.send", { ...payload, request_id: "other" })).rejects.toThrow("Stop");
    f.complete();
    await until(() => f.db.row("SELECT status FROM turns")?.status === "completed");
    expect(f.db.messages(thread.thread_id).map(row => row.content)).toEqual(["Real question", "Hello"]);
    const events = f.db.events(thread.thread_id, 0);
    expect(events.map(event => event.type)).toEqual(["delta", "tool", "done"]);
    expect(f.db.events(thread.thread_id, events[0]!.seq).map(event => event.seq)).toEqual([2, 3]);
    expect(f.db.events(thread.thread_id, events.at(-1)!.seq)).toEqual([]);
    expect(store(String(f.db.db.filename).replace(/\/chat\.sqlite3$/, "")).events(thread.thread_id, 0)).toEqual(events);
  });

  test("Stop delegates to runtime and retains the received response", async () => {
    const f = fixture(); const thread = await f.app.call("threads.create") as Row;
    await f.app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Hello" });
    await f.app.call("message.send", { thread_id: thread.thread_id, request_id: "stop-1", provider_id: "local" });
    expect(await f.app.call("turn.cancel", { request_id: "stop-1" })).toBe(true);
    await until(() => f.db.row("SELECT status FROM turns")?.status === "stopped");
    expect(f.db.messages(thread.thread_id).at(-1)?.content).toBe("Hello");
    expect(f.db.events(thread.thread_id, 0).at(-1)?.type).toBe("cancelled");
  });

  test("a runtime failure is recorded and visible rather than a saved assistant success", async () => {
    const db = store(); const app = new ChatBackend(db, async op => { if (op === "preferences") return []; throw new Error("offline"); });
    const thread = await app.call("threads.create") as Row;
    await app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Hello" });
    await expect(app.call("message.send", { thread_id: thread.thread_id, request_id: "offline", provider_id: "local" })).rejects.toThrow("offline");
    expect(db.messages(thread.thread_id)).toHaveLength(1);
    expect(db.events(thread.thread_id, 0).at(-1)?.type).toBe("failed");
  });
});

test("an unknown runtime start blocks another turn and is never replayed on recovery", async () => {
  const db = store(); let starts = 0; let online = false;
  const runtime = async (op: string): Promise<any> => {
    if (op === "preferences") return [];
    if (op === "start") { starts++; throw new Error("connection lost"); }
    if (!online) throw new Error("offline");
    if (op === "lookup") return { found: false };
    throw new Error(op);
  };
  const app = new ChatBackend(db, runtime);
  const thread = await app.call("threads.create") as Row;
  await app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Hello" });
  await expect(app.call("message.send", { thread_id: thread.thread_id, request_id: "uncertain", provider_id: "local" })).rejects.toThrow();
  expect(db.row("SELECT status FROM turns")?.status).toBe("unknown");
  await expect(app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Again" })).rejects.toThrow("Stop");
  online = true;
  new ChatBackend(db, runtime).turns.recover();
  await until(() => db.row("SELECT status FROM turns")?.status === "failed");
  expect(starts).toBe(1);
});

test("a failed SQLite write never reports a saved message", async () => {
  const db = store(); const app = new ChatBackend(db, async () => []);
  const thread = await app.call("threads.create") as Row;
  db.db.exec("PRAGMA query_only=ON");
  await expect(app.call("messages.append", { thread_id: thread.thread_id, role: "user", content: "Not saved" })).rejects.toThrow();
  expect(db.messages(thread.thread_id)).toEqual([]);
});

test("stream snapshots expose existing work without restarting it and cursors stay per conversation", async () => {
  const f = fixture();
  const one = await f.app.call("threads.create") as Row;
  const two = await f.app.call("threads.create") as Row;
  f.db.emit(one.thread_id, "delta", { request_id: "one", text: "Private" });
  f.db.emit(two.thread_id, "done", { request_id: "two" });
  expect(f.db.events(two.thread_id, 0).map(row => row.type)).toEqual(["done"]);
  expect(() => f.db.events(one.thread_id, 99)).toThrow("ahead");
  f.db.run("INSERT INTO turns(request_id,thread_id,work_id,status,input_count,partial,created_at) VALUES('existing',?,'existing-work','running',1,'Already received',1)", one.thread_id);
  expect(await f.app.call("stream.snapshot", { thread_id: one.thread_id })).toMatchObject({ cursor: 1, active: { request_id: "existing", partial: "Already received" } });
  expect(f.input).toHaveLength(0);
});
