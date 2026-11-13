# Chat — a Ponpoko surface

Chat is the conversation you have with Poko, installed as a surface instead of shipped inside
the app. It has its own repository, its own lockfile, its own build and its own tests: it builds
from a checkout of itself and from nothing else.

```sh
git clone git@github.com:zurge-co/ponpoko-surface-chat.git
cd ponpoko-surface-chat
bun install --ignore-scripts
bun run typecheck
bun test
bun run build
bun run lint
```

`bun run build` produces `dist/`: the entry `index.html`, its assets, `surface.json` and a
`bundle.json` summary. Ponpoko installs `dist/` through its own installer
(`ponpoko surface-install --bundle <path>/dist`), and the tab bar picks up the `nav`
contribution the manifest declares.

## What lives where

| Chat surface | Ponpoko Host |
| --- | --- |
| thread history, search, pins, settings and export in its own SQLite store | provider configuration and credentials |
| conversation context, system prompt, turn orchestration and durable stream events | one shared AI/tool work runner, budgets, leases and checkpoints |
| UI, Markdown, PonpokoUI, attachments and presentation preferences | generic OS dialogs, clipboard, palette, installation and work services |

`backend/` builds into `dist/bin/chat-backend`, a standalone executable with its JavaScript
runtime included. End users do not need Bun installed to run this backend. Build dependencies
are installed from this repository's lockfile. The bundled runtime makes this bundle about
86 MiB on macOS; Host uses the same 128 MiB bundle limit for every surface.

Host supplies `PONPOKO_SURFACE_DATA_DIR` and `PONPOKO_HOST_CONTROL` to every backend.
Conversations live in `chat.sqlite3` inside that data directory, outside the installed bundle.
On first launch only, `PONPOKO_HOST_DATABASE` supplies the legacy database for a read-only,
transactional import. IDs, ordering, timestamps, custom instructions and tool metadata survive.
The migration ledger prevents a deleted conversation from returning on reinstall. The original
Host rows are retained for old CLI/work traces; new Chat messages are written only to Chat's store.

The page never imports Tauri or holds a provider key. Conversation calls use normal
`host.surface/backend.call`; OS services use `host.platform`. The backend owns its prompt and
asks the generic authenticated Host runtime to execute budgeted work. It observes existing work
after restart, and never automatically retries a mutation with an unknown outcome.
See [`docs/host-protocol.md`](docs/host-protocol.md).

## Trust, honestly

There is **no sandbox**. A surface is code the human chose to install, running in a frame. The
broker narrows what Chat can *ask for* — a closed list of operations, no arbitrary invoke, no raw
filesystem read — but it is not a security boundary against hostile code, and this README does
not claim one.

## Layout

```text
surface.json          the manifest and backend methods the host parser reads
backend/              durable history, migration, context and turn orchestration
src/main.tsx          mount, boot, and the unhosted/mismatch screens
src/app/              Chat shell, host API, boot
src/bridge/           versioned broker client (channel, request, answer, events)
src/contracts/        the wire contract shared by both sides: protocol, errors, row readers
src/chat/             the conversation UI, moved out of the host and adapted
src/ponpoko-ui/       the PonpokoUI catalogue, lexer, parser and evaluator (vendored)
src/styles/           palette tokens, Markdown and mascot motion
test/                 broker, contract and parity proofs
docs/                 the host protocol and where every file came from
```

## Checks that must be green

`bun run typecheck`, `bun test`, `bun run build`, `bun run lint`.

`bun scripts/standalone.mjs` copies this checkout to a temp directory outside the host tree
without `node_modules` or `dist`, then installs and runs all four there. That is the proof the
bundle stands alone; run it before claiming the surface builds from its own checkout.

AI calls declare text input/output modalities; Host selects a compatible slot. The bundle owns context and turns,
while the Host resolves the account or device connection, pins the invocation model, and
records usage against this surface. No provider key or Cloud token reaches the bundle.

### Host keyboard shortcuts

Cmd/Ctrl+1–9 switches Favorite surfaces and Cmd/Ctrl+K opens Ponpoko's surface picker.
Chat leaves these chords to the Host. Cmd/Ctrl+Shift+P opens Chat's own command palette.

See [the public SDK contract and compatibility checks](docs/sdk.md).
