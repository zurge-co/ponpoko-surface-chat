import { writeFileSync } from "node:fs";
import { ChatStore, now, type Row } from "./store";
import { Turns } from "./turns";
import type { Runtime } from "./runtime";

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export class ChatBackend {
  readonly turns: Turns;
  readonly store: ChatStore;
  private runtime: Runtime;
  constructor(store: ChatStore, runtime: Runtime) { this.store = store; this.runtime = runtime; this.turns = new Turns(store, runtime); }

  async call(method: string, p: Row = {}): Promise<unknown> {
    const id = typeof p.thread_id === "string" ? p.thread_id : "";
    switch (method) {
      case "app.info": return { protocol: 1, host_version: "ponpoko", identity: process.env.PONPOKO_SURFACE_ID ?? "chat", storage: "surface-backend" };
      case "threads.list": return this.store.list();
      case "threads.create": {
        const id = crypto.randomUUID();
        this.store.run("INSERT INTO threads(thread_id,title,created_at,updated_at) VALUES(?,?,?,?)", id, typeof p.title === "string" ? p.title : "New conversation", now(), now());
        return this.store.thread(id);
      }
      case "threads.rename":
        this.store.thread(id);
        this.store.run("UPDATE threads SET title=?,updated_at=? WHERE thread_id=?", text(p.title, "title"), now(), id);
        return this.store.thread(id);
      case "threads.pin":
        this.store.thread(id);
        this.store.run("UPDATE threads SET pinned=? WHERE thread_id=?", p.pinned === true ? 1 : 0, id);
        return this.store.thread(id);
      case "threads.update": {
        this.store.idle(id);
        const thread = this.store.thread(id)!;
        this.store.run("UPDATE threads SET title=?,style_id=?,system_prompt=?,provider_id=?,pinned=?,updated_at=? WHERE thread_id=?",
          p.title ?? thread.title, p.style_id ?? "general", p.system_prompt ?? "", p.provider_id || null, p.pinned === true ? 1 : 0, now(), id);
        return this.store.thread(id);
      }
      case "threads.delete":
        this.store.idle(id);
        return this.store.run("DELETE FROM threads WHERE thread_id=?", id).changes > 0;
      case "threads.search": {
        const q = String(p.query ?? "").toLocaleLowerCase().trim();
        return this.store.list().flatMap(thread => {
          const matches = this.store.messages(thread.thread_id).filter(row => row.content.toLocaleLowerCase().includes(q));
          if (!thread.title.toLocaleLowerCase().includes(q) && matches.length === 0) return [];
          return [{ thread, snippet: String(matches[0]?.content ?? thread.title).slice(0, 240), match_count: matches.length + (thread.title.toLocaleLowerCase().includes(q) ? 1 : 0) }];
        });
      }
      case "threads.export": {
        const thread = this.store.thread(id)!;
        const body = `# ${thread.title}\n\n` + this.store.messages(id).map(row => `## ${row.role}\n\n${row.content}\n`).join("\n");
        const path = text(p.path, "path");
        writeFileSync(path, body, { encoding: "utf8" });
        return { path };
      }
      case "messages.list": return this.store.messages(id);
      case "messages.append":
        this.store.idle(id);
        return this.store.append(id, text(p.role, "role"), typeof p.content === "string" ? p.content : "");
      case "messages.truncate":
        this.store.idle(id);
        if (!Number.isSafeInteger(p.keep_seq) || p.keep_seq < 0) throw new Error("keep_seq must be a non-negative integer");
        return this.store.run("DELETE FROM messages WHERE thread_id=? AND seq>?", id, p.keep_seq).changes;
      case "message.send": return this.turns.send(p);
      case "turn.cancel": return this.turns.cancel(text(p.request_id, "request_id"));
      case "stream.snapshot": return this.store.atomic(() => {
        this.store.thread(id);
        return { cursor: this.store.row("SELECT MAX(seq) AS seq FROM events WHERE thread_id=?", id)?.seq ?? 0,
          active: this.store.row("SELECT request_id,status,partial,error FROM turns WHERE thread_id=? AND status IN ('starting','running','unknown')", id) };
      });
      case "stream.events": {
        const after = p.after ?? 0;
        if (!Number.isSafeInteger(after) || after < 0) throw new Error("after must be a non-negative integer");
        return this.store.events(id, after);
      }
      case "providers.list": {
        const slots = await this.runtime("slots");
        const local = slots.local.find((slot: Row) => slot.io?.inputs?.includes("text") && slot.io?.outputs?.includes("text"));
        const cloud = slots.cloud.find((slot: Row) => slot.io?.inputs?.includes("text") && slot.io?.outputs?.includes("text") && slot.enabled && slot.status === "active");
        const model = local?.model ?? cloud?.alias_id;
        return model ? [{provider_id:"default-slot",label:"Ponpoko AI",model,has_key:true}] : [];
      }
      case "preferences.list": return this.store.rows("SELECT key,value FROM settings ORDER BY key");
      case "preferences.set":
        this.store.run("INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", text(p.key, "key"), text(p.value, "value"));
        return true;
      default: throw new Error(`Unknown Chat backend method '${method}'`);
    }
  }
}
