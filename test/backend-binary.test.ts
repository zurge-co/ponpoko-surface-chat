import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const binary = resolve(import.meta.dir, "../dist/bin/chat-backend");
test.skipIf(!existsSync(binary))("the installed backend runs without Bun or a Host checkout on PATH", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ponpoko-chat-binary-"));
  try {
    const control = join(dir, "control.json");
    writeFileSync(control, JSON.stringify({ protocol: 1, url: "http://127.0.0.1:1/", token: "fixture-token-only" }));
    const child = Bun.spawn([binary], { cwd: dir, env: { PATH: "/usr/bin:/bin", PONPOKO_SURFACE_ID: "ordinary-notes", PONPOKO_SURFACE_DATA_DIR: join(dir, "data"), PONPOKO_HOST_CONTROL: control }, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "app.info", params: {} }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "threads.create", params: { title: "Own history" } }) + "\n");
    child.stdin.end();
    const output = await new Response(child.stdout).text();
    const error = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(error).toBe("");
    const rows = output.trim().split("\n").map(line => JSON.parse(line));
    expect(rows[0].result).toMatchObject({ protocol: 1, identity: "ordinary-notes", storage: "surface-backend" });
    expect(rows[1].result.title).toBe("Own history");
    expect(existsSync(join(dir, "data", "chat.sqlite3"))).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
