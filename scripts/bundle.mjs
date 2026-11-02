import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(PROJECT, "dist");
const MANIFEST = join(PROJECT, "surface.json");

const MAX_FILES = 4096;
const MAX_BYTES = 64 * 1024 * 1024;

function fail(message) {
  console.error(`bundle: ${message}`);
  process.exit(1);
}

async function walk(root, current = root, out = []) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, path, out);
      continue;
    }
    const info = await stat(path);
    out.push({ path, rel: relative(root, path).split("\\").join("/"), bytes: info.size });
  }
  return out;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const entry = String(manifest.entry ?? "").trim();
  if (entry.length === 0) fail("surface.json names no entry document");

  const entryPath = join(DIST, entry);
  try {
    await stat(entryPath);
  } catch {
    fail(`the build produced no ${entry} — vite did not finish, so there is nothing to install`);
  }

  const files = await walk(DIST);
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  if (files.length > MAX_FILES) fail(`${files.length} files is more than the host's ${MAX_FILES}`);
  if (total > MAX_BYTES) fail(`${total} bytes is more than the host's ${MAX_BYTES}`);

  const absolute = files
    .map((file) => relative(DIST, file.path))
    .filter((path) => path.includes(PROJECT) || path.startsWith(".."));
  if (absolute.length > 0) fail(`the bundle points outside itself: ${absolute.join(", ")}`);

  const text = await Promise.all(
    files
      .filter((file) => /\.(js|css|html)$/.test(file.rel))
      .map(async (file) => ({ rel: file.rel, body: await readFile(file.path, "utf8") })),
  );
  const leaking = text.filter((file) => /__TAURI_INTERNALS__|tauri:\/\/|ponpoko\/app\/node_modules/.test(file.body));
  if (leaking.length > 0) {
    fail(`the bundle reaches for the host's own runtime: ${leaking.map((file) => file.rel).join(", ")}`);
  }
  const homeLeaks = text.filter((file) => file.body.includes(PROJECT));
  if (homeLeaks.length > 0) {
    fail(`the bundle carries this checkout's path: ${homeLeaks.map((file) => file.rel).join(", ")}`);
  }

  await mkdir(DIST, { recursive: true });
  await copyFile(MANIFEST, join(DIST, "surface.json"));

  const summary = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    entry,
    files: files.length + 1,
    bytes: total,
  };
  await writeFile(join(DIST, "bundle.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    `bundle: ${summary.files} files, ${summary.bytes} bytes, entry ${entry}, ${manifest.id}@${manifest.version}`,
  );
}

await main();
