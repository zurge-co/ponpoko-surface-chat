import { contextMessages } from "./context";
import { ChatStore, now, type Row } from "./store";
import { resolveChatStyle } from "../src/lib/chatStyles";
import { buildPonpokoUISystemPrompt } from "../src/ponpoko-ui/prompt";
import { chatLanguageDirective } from "../src/lib/prompts/language";
import type { Runtime } from "./runtime";

const terminal = new Set(["completed", "failed", "stopped", "interrupted", "paused", "needs_input"]);

export class Turns {
  private observing = new Set<string>();
  private store: ChatStore;
  private runtime: Runtime;
  constructor(store: ChatStore, runtime: Runtime) { this.store = store; this.runtime = runtime; }

  async send(payload: Row) {
    const requestId = String(payload.request_id ?? "").trim();
    const id = String(payload.thread_id ?? "").trim();
    if (!requestId || requestId.length > 64) throw new Error("A turn needs a request_id of at most 64 characters");
    const previous = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId);
    if (previous) {
      if (previous.thread_id !== id) throw new Error("request_id belongs to another conversation");
      return { request_id: requestId, thread_id: id };
    }
    this.store.idle(id);
    const thread = this.store.thread(id)!;
    const messages = contextMessages(this.store.messages(id));
    if (!messages.length || messages.at(-1)?.role !== "user") throw new Error("A turn needs a saved human message");
    const preferences = await this.runtime("preferences");
    const language = preferences.find((row: Row) => row.key === "chat_language")?.value ?? "auto";
    const provider = thread.provider_id ?? payload.provider_id;
    if (typeof provider !== "string" || !provider.trim()) throw new Error("Choose a model first");
    this.store.run("INSERT INTO turns(request_id,thread_id,status,input_count,created_at) VALUES(?,?,'starting',?,?)", requestId, id, messages.length, now());
    try {
      const result = await this.runtime("start", { input: { request_id: requestId, provider_id: provider,
        system: systemPrompt(thread, language, messages.at(-1)?.content), messages, rounds: 24, seconds: 300, output_bytes: 1_048_576, with_tools: true } });
      this.store.run("UPDATE turns SET work_id=?,status='running' WHERE request_id=?", result.work_id, requestId);
      this.observe(requestId);
    } catch (error) {
      await this.reconcile(requestId, String(error));
      throw error;
    }
    return { request_id: requestId, thread_id: id };
  }

  recover() {
    for (const turn of this.store.rows("SELECT * FROM turns WHERE status IN ('starting','running','unknown')")) {
      if (turn.work_id) {
        this.store.run("UPDATE turns SET status='running' WHERE request_id=?", turn.request_id);
        this.observe(turn.request_id);
      }
      else void this.reconcile(turn.request_id, "Chat restarted before the runtime start was confirmed");
    }
  }

  private async reconcile(requestId: string, reason: string) {
    try {
      const found = await this.runtime("lookup", { request_id: requestId });
      if (!found.found) { this.fail(requestId, reason); return; }
      this.store.run("UPDATE turns SET work_id=?,status='running' WHERE request_id=?", found.work_id, requestId);
      this.observe(requestId);
    } catch {
      const turn = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId)!;
      this.store.atomic(() => {
        this.store.run("UPDATE turns SET status='unknown',error=? WHERE request_id=?", reason, requestId);
        this.store.emit(turn.thread_id, "failed", { request_id: requestId, message: `${reason}. The outcome is unknown; reload Chat to inspect the existing work before sending another turn.` });
      });
    }
  }

  private unknown(requestId: string, message: string) {
    const turn = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId);
    if (!turn) return;
    this.store.atomic(() => {
      this.store.run("UPDATE turns SET status='unknown',error=? WHERE request_id=?", message, requestId);
      this.store.emit(turn.thread_id, "failed", { request_id: requestId, message: `${message}. Reload Chat to inspect the existing work; it has not been replayed.` });
    });
  }

  private fail(requestId: string, message: string) {
    this.store.atomic(() => {
      const turn = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId);
      if (!turn) return;
      this.store.run("UPDATE turns SET status='failed',error=? WHERE request_id=?", message, requestId);
      this.store.emit(turn.thread_id, "failed", { request_id: requestId, message });
    });
  }

  async cancel(requestId: string) {
    const turn = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId);
    if (!turn || !["starting", "running", "unknown"].includes(turn.status)) return false;
    if (!turn.work_id) {
      await this.reconcile(requestId, "Inspecting an uncertain turn before stopping");
      const found = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId)!;
      if (!found.work_id) throw new Error("The runtime could not be reached; the uncertain turn has not been replayed");
      turn.work_id = found.work_id;
    }
    await this.runtime("stop", { work_id: turn.work_id });
    return true;
  }

  private observe(requestId: string) {
    if (this.observing.has(requestId)) return;
    this.observing.add(requestId);
    void this.follow(requestId).catch(error => this.unknown(requestId, String(error))).finally(() => this.observing.delete(requestId));
  }

  private async follow(requestId: string) {
    while (true) {
      const turn = this.store.row("SELECT * FROM turns WHERE request_id=?", requestId);
      if (!turn || turn.status !== "running") return;
      const page = await this.runtime("events", { work_id: turn.work_id, after: turn.runtime_cursor });
      this.store.atomic(() => {
        for (const event of page.events ?? []) {
          if (typeof event.payload?.text_delta === "string") {
            const text = event.payload.text_delta;
            this.store.run("UPDATE turns SET partial=partial||? WHERE request_id=?", text, requestId);
            this.store.emit(turn.thread_id, "delta", { request_id: requestId, text });
          } else if (event.event_type === "tool_finished") this.store.emit(turn.thread_id, "tool", { request_id: requestId, ...event.payload });
        }
        this.store.run("UPDATE turns SET runtime_cursor=? WHERE request_id=?", page.cursor, requestId);
      });
      if (page.exhausted !== false) {
        const status = await this.runtime("status", { work_id: turn.work_id });
        if (terminal.has(status.status) && status.cursor <= page.cursor) {
          this.finish(turn, status);
          return;
        }
      }
      await Bun.sleep(120);
    }
  }

  private finish(turn: Row, status: Row) {
    this.store.atomic(() => {
      const current = this.store.row("SELECT * FROM turns WHERE request_id=?", turn.request_id)!;
      if (current.status !== "running") return;
      const messages = Array.isArray(status.messages) ? status.messages.slice(turn.input_count) : [];
      for (const message of messages) {
        const { role, content, ...meta } = message;
        this.store.append(turn.thread_id, role, content ?? "", JSON.stringify(meta));
      }
      if (messages.length === 0 && current.partial) this.store.append(turn.thread_id, "assistant", current.partial, JSON.stringify({ interrupted: status.status !== "completed" }));
      const type = status.status === "completed" ? "done" : status.status === "stopped" ? "cancelled" : "failed";
      this.store.run("UPDATE turns SET status=?,error=? WHERE request_id=?", status.status, status.reason ?? null, turn.request_id);
      this.store.emit(turn.thread_id, type, { request_id: turn.request_id, message: status.reason ?? `Runtime ${status.status}` });
    });
  }
}

function systemPrompt(thread: Row, language: string, sample?: string): string {
  return ["You are Poko, the assistant in this conversation.", resolveChatStyle(thread.style_id).preamble,
    "When a user requests a lasting screen or tool, consult surface_recommend and create and verify an installed surface. Answer ordinary questions directly.",
    chatLanguageDirective(language, sample), buildPonpokoUISystemPrompt(), thread.system_prompt].filter(Boolean).join("\n\n");
}
