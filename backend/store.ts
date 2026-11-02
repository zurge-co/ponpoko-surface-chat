import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type Row = Record<string, any>;
export const now = () => Math.floor(Date.now() / 1000);

export class ChatStore {
  readonly db: Database;

  constructor(directory: string, legacy?: string) {
    mkdirSync(directory, { recursive: true });
    this.db = new Database(join(directory, "chat.sqlite3"), { create: true, strict: true });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS threads (thread_id TEXT PRIMARY KEY, title TEXT NOT NULL,
        style_id TEXT NOT NULL DEFAULT 'general', system_prompt TEXT NOT NULL DEFAULT '',
        provider_id TEXT, pinned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (message_id INTEGER PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads ON DELETE CASCADE,
        seq INTEGER NOT NULL CHECK(seq>0), role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
        content TEXT NOT NULL, meta_json TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, UNIQUE(thread_id,seq));
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, completed_at INTEGER NOT NULL, details TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS turns (request_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads ON DELETE CASCADE,
        work_id TEXT, status TEXT NOT NULL, input_count INTEGER NOT NULL, runtime_cursor INTEGER NOT NULL DEFAULT 0,
        partial TEXT NOT NULL DEFAULT '', error TEXT, created_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS active_thread ON turns(thread_id) WHERE status IN ('starting','running','unknown');
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads ON DELETE CASCADE,
        seq INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, timestamp INTEGER NOT NULL, UNIQUE(thread_id,seq));`);
    this.importLegacy(legacy);
  }

  rows(sql: string, ...args: any[]): Row[] { return this.db.query(sql).all(...args) as Row[]; }
  row(sql: string, ...args: any[]): Row | null { return this.db.query(sql).get(...args) as Row | null; }
  run(sql: string, ...args: any[]) { return this.db.query(sql).run(...args); }
  atomic<T>(fn: () => T): T { return this.db.transaction(fn).immediate(); }

  importLegacy(source?: string) {
    if (this.row("SELECT name FROM migrations WHERE name='host-history'")) return;
    if (!source || !existsSync(source)) return;
    const legacy = new Database(source, { readonly: true, strict: true });
    try {
      const copied = legacy.transaction(() => {
        const tables = legacy.query("SELECT name FROM sqlite_master WHERE type='table'").all() as Row[];
        if (!tables.some(row => row.name === "chat_thread")) return { threads: [], messages: [] };
        return { threads: legacy.query("SELECT * FROM chat_thread").all() as Row[], messages: legacy.query("SELECT * FROM chat_message ORDER BY message_id").all() as Row[] };
      })();
      this.atomic(() => {
        if (this.row("SELECT name FROM migrations WHERE name='host-history'")) return;
        for (const row of copied.threads) {
          const existing = this.thread(row.thread_id, false);
          if (existing) throw new Error("History import conflicts with an existing conversation; the original database is unchanged");
          this.run("INSERT INTO threads VALUES(?,?,?,?,?,?,?,?)", row.thread_id, row.title, row.style_id, row.system_prompt, row.provider_id, row.pinned, row.created_at, row.updated_at);
        }
        for (const row of copied.messages) this.run("INSERT INTO messages VALUES(?,?,?,?,?,?,?)", row.message_id, row.thread_id, row.seq, row.role, row.content, row.meta_json, row.created_at);
        this.run("INSERT INTO migrations VALUES('host-history',?,?)", now(), JSON.stringify({ threads: copied.threads.length, messages: copied.messages.length }));
      });
    } finally { legacy.close(); }
  }

  thread(id: string, required = true): Row | null {
    const row = this.row("SELECT * FROM threads WHERE thread_id=?", id);
    if (!row && required) throw new Error("Conversation no longer exists");
    return row ? { ...row, pinned: row.pinned === 1 } : null;
  }
  idle(id: string) {
    this.thread(id);
    if (this.row("SELECT request_id FROM turns WHERE thread_id=? AND status IN ('starting','running','unknown')", id)) throw new Error("Stop the current turn before changing its conversation");
  }
  list(): Row[] { return this.rows("SELECT * FROM threads ORDER BY pinned DESC, updated_at DESC, thread_id").map(row => ({ ...row, pinned: row.pinned === 1 })); }
  messages(id: string) { this.thread(id); return this.rows("SELECT message_id,seq,role,content,meta_json,created_at FROM messages WHERE thread_id=? ORDER BY seq", id); }
  append(id: string, role: string, content: string, meta = "") {
    if (!["system", "user", "assistant", "tool"].includes(role)) throw new Error("Invalid message role");
    return this.atomic(() => {
      this.thread(id);
      const seq = (this.row("SELECT MAX(seq) AS seq FROM messages WHERE thread_id=?", id)?.seq ?? 0) + 1;
      const result = this.run("INSERT INTO messages(thread_id,seq,role,content,meta_json,created_at) VALUES(?,?,?,?,?,?)", id, seq, role, content, meta, now());
      this.run("UPDATE threads SET updated_at=? WHERE thread_id=?", now(), id);
      return this.row("SELECT message_id,seq,role,content,meta_json,created_at FROM messages WHERE message_id=?", result.lastInsertRowid);
    });
  }
  emit(id: string, type: string, payload: Row) {
    const seq = (this.row("SELECT MAX(seq) AS seq FROM events WHERE thread_id=?", id)?.seq ?? 0) + 1;
    this.run("INSERT INTO events(thread_id,seq,type,payload,timestamp) VALUES(?,?,?,?,?)", id, seq, type, JSON.stringify({ ...payload, thread_id: id }), now());
  }
  events(id: string, after: number) {
    this.thread(id);
    const head = this.row("SELECT MAX(seq) AS seq FROM events WHERE thread_id=?", id)?.seq ?? 0;
    if (after > head) throw new Error("Event cursor is ahead of this conversation");
    return this.rows("SELECT * FROM events WHERE thread_id=? AND seq>? ORDER BY seq LIMIT 500", id, after)
      .map(row => ({ ...row, event_id: `${id}:${row.seq}`, payload: JSON.parse(row.payload) }));
  }
}
