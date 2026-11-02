const { describe, test, expect } = await import("bun:test");
const { readdir, readFile, stat } = await import("node:fs/promises");
const { join, resolve } = await import("node:path");
const protocol = await import("../src/contracts/protocol");

const ROOT = resolve(import.meta.dir, "..");

const CLIENT_ONLY = new Set([
  "thread group labels",
  "delta batching",
  "syntax highlighting token classes",
  "palette ranking",
  "markdown block parsing",
  "ponpoko-ui evaluation",
]);

interface ParityRow {
  capability: string;
  hostCall: string | null;
  where: string;
}

const ROWS: ParityRow[] = [
  { capability: "list threads", hostCall: "threads.list", where: "src/app/host.ts" },
  { capability: "create thread", hostCall: "threads.create", where: "src/app/host.ts" },
  { capability: "rename thread", hostCall: "threads.rename", where: "src/app/host.ts" },
  { capability: "update thread settings", hostCall: "threads.update", where: "src/app/host.ts" },
  { capability: "pin thread", hostCall: "threads.pin", where: "src/app/host.ts" },
  { capability: "delete thread", hostCall: "threads.delete", where: "src/app/host.ts" },
  { capability: "search threads", hostCall: "threads.search", where: "src/app/host.ts" },
  { capability: "export thread", hostCall: "threads.export", where: "src/app/host.ts" },
  { capability: "read messages", hostCall: "messages.list", where: "src/app/host.ts" },
  { capability: "append message", hostCall: "messages.append", where: "src/app/host.ts" },
  { capability: "truncate messages", hostCall: "messages.truncate", where: "src/app/host.ts" },
  { capability: "stream a turn", hostCall: "message.send", where: "src/app/host.ts" },
  { capability: "cancel a turn", hostCall: "turn.cancel", where: "src/app/host.ts" },
  { capability: "subscribe stream", hostCall: "stream.subscribe", where: "src/app/host.ts" },
  { capability: "unsubscribe stream", hostCall: "stream.unsubscribe", where: "src/app/host.ts" },
  { capability: "provider display metadata", hostCall: "providers.list", where: "src/app/host.ts" },
  { capability: "pick attachments", hostCall: "attachments.pick", where: "src/app/host.ts" },
  { capability: "read attachments", hostCall: "attachments.read", where: "src/app/host.ts" },
  { capability: "paste an image", hostCall: "attachments.paste-image", where: "src/app/host.ts" },
  { capability: "chat language preference", hostCall: "preferences.list", where: "src/app/host.ts" },
  { capability: "host settings window", hostCall: "settings.open", where: "src/app/host.ts" },
  { capability: "open an external link", hostCall: "link.open", where: "src/app/host.ts" },
  { capability: "protocol handshake", hostCall: "protocol.info", where: "src/app/host.ts" },
  { capability: "markdown rendering", hostCall: null, where: "src/chat/Markdown.tsx" },
  { capability: "ponpoko-ui rendering", hostCall: null, where: "src/chat/ponpoko-ui/PonpokoUIBlock.tsx" },
  { capability: "clipboard copy", hostCall: null, where: "src/lib/clipboard.ts" },
  { capability: "thread grouping", hostCall: null, where: "src/chat/navigation.ts" },
  { capability: "delta batching", hostCall: null, where: "src/chat/streamBuffer.ts" },
  { capability: "context fences", hostCall: null, where: "src/chat/context.ts" },
  { capability: "keyboard shortcuts", hostCall: null, where: "src/chat/navigation.ts" },
];

async function sourceText(): Promise<string> {
  const files = await walk(resolve(ROOT, "src"));
  const bodies = await Promise.all(files.map((file) => readFile(file, "utf8")));
  return bodies.join("\n");
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe("harness parity inventory", () => {
  test("every host-backed capability names a real operation of the closed union", () => {
    for (const row of ROWS) {
      if (row.hostCall === null) continue;
      expect(protocol.isOperation("host.chat", row.hostCall)).toBe(true);
    }
  });

  test("every capability in the inventory has a file that exists", async () => {
    for (const row of ROWS) {
      const info = await stat(join(ROOT, row.where)).catch(() => null);
      expect(info?.isFile()).toBe(true);
    }
  });

  test("the surface reaches for no host runtime of its own", async () => {
    const text = await sourceText();
    expect(text).not.toContain("@tauri-apps");
    expect(text).not.toContain("__TAURI_INTERNALS__");
    expect(text).not.toContain("../ponpoko/");
    expect(text).not.toContain("/Users/");
  });

  test("client-only capabilities are named and never pretend to be host calls", () => {
    for (const entry of CLIENT_ONLY) {
      const row = ROWS.find((candidate) => candidate.capability === entry);
      if (!row) continue;
      expect(row.hostCall).toBeNull();
    }
  });

  test("no row claims a capability that only exists in a comment", async () => {
    const text = await sourceText();
    for (const row of ROWS) {
      if (row.hostCall === null) continue;
      expect(text).toContain(row.hostCall);
    }
  });
});

describe("standalone checkout", () => {
  test("the manifest is a kebab id the host parser accepts, with a supported icon", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "surface.json"), "utf8"));
    expect(manifest.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(manifest.entry).toMatch(/\.html$/);
    expect(manifest.contributes[0].slot).toBe("nav");
    expect(["file-code", "git-branch", "terminal", "palette", "package", "generic"]).toContain(
      manifest.contributes[0].icon,
    );
    expect(manifest).not.toHaveProperty("permissions");
    expect(manifest).not.toHaveProperty("doors");
  });

  test("the package declares the checks a host build runs, and a lockfile exists", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
    for (const script of ["typecheck", "build", "test", "lint"]) {
      expect(typeof pkg.scripts[script]).toBe("string");
    }
    expect(pkg.scripts.build).toContain("typecheck");
    const lock = await stat(join(ROOT, "bun.lock"));
    expect(lock.isFile()).toBe(true);
  });

  test("the bundle carries the manifest, its entry and no absolute path", async () => {
    const dist = join(ROOT, "dist");
    const present = await stat(dist).catch(() => null);
    if (!present) return;
    expect((await stat(join(dist, "surface.json"))).isFile()).toBe(true);
    expect((await stat(join(dist, "index.html"))).isFile()).toBe(true);
    const summary = JSON.parse(await readFile(join(dist, "bundle.json"), "utf8"));
    expect(summary.bytes).toBeLessThan(64 * 1024 * 1024);
    expect(summary.files).toBeLessThanOrEqual(4096);
  });
});
