import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", ".git"]);

function run(command, args, cwd) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", (error) =>
      fail(new Error(`${command} could not start (${error.code ?? error.message})`)),
    );
    child.on("exit", (code) =>
      code === 0 ? done() : fail(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

async function walk(root, current = root, out = []) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(current, entry.name);
    if (entry.isDirectory()) await walk(root, path, out);
    else out.push(path);
  }
  return out;
}

async function isDirectory(path) {
  const info = await stat(path).catch(() => null);
  return Boolean(info?.isDirectory());
}

async function main() {
  const home = process.env.HOME ?? "";
  const parent = tmpdir();
  if (home.length > 0 && resolve(parent).startsWith(resolve(home, "zurge"))) {
    console.error(`standalone: ${parent} sits under the host checkout; choose another temp root`);
    process.exit(1);
  }

  const copy = await mkdtemp(join(parent, "ponpoko-chat-standalone-"));
  for (const entry of await readdir(PROJECT, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    await cp(join(PROJECT, entry.name), join(copy, entry.name), { recursive: true });
  }

  const files = await walk(copy);
  const leaks = [];
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs|json|html|css)$/.test(file)) continue;
    const body = await readFile(file, "utf8");
    const rel = relative(copy, file);
    if (body.includes(PROJECT)) leaks.push(`${rel}: this checkout's path`);
    if (/from ["']\.\.\/ponpoko\//.test(body)) leaks.push(`${rel}: import from the host`);
  }
  for (const file of files.filter((path) => relative(copy, path).startsWith(`src${sep}`))) {
    const body = await readFile(file, "utf8");
    if (/__TAURI_INTERNALS__|@tauri-apps\//.test(body)) {
      leaks.push(`${relative(copy, file)}: the host's own runtime`);
    }
  }
  if (await isDirectory(join(copy, "node_modules"))) leaks.push("node_modules was copied");
  if (await isDirectory(join(copy, "dist"))) leaks.push("dist was copied");
  if (leaks.length > 0) {
    console.error(`standalone: the copy is not standalone\n${leaks.join("\n")}`);
    process.exit(1);
  }

  console.log(`standalone: ${files.length} files copied to ${copy} with no node_modules and no dist`);
  await run("bun", ["install", "--ignore-scripts", "--frozen-lockfile"], copy);
  await run("bun", ["run", "typecheck"], copy);
  await run("bun", ["run", "build"], copy);
  await run("bun", ["test"], copy);
  await run("bun", ["run", "lint"], copy);

  const summary = JSON.parse(await readFile(join(copy, "dist", "bundle.json"), "utf8"));
  console.log(
    `standalone: install, typecheck, test, build and lint passed in ${copy} — bundle ${summary.files} files, ${summary.bytes} bytes`,
  );
  console.log(`standalone: leaving ${copy} in place as evidence`);
}

await main();
