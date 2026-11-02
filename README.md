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

| Here | Ponpoko's host |
| --- | --- |
| threads rail, transcript, composer, Markdown, PonpokoUI, search, export, shortcuts | providers, credentials, the model and tool loop |
| presentation preferences (rail collapsed, chosen provider id, theme) | central transcript database and migrations |
| the broker client in `src/bridge/` | the composed system prompt and checkpoints |
| the icons and motion of the mascot | install, storage, probes and Git consent |

The page never imports `@tauri-apps`, never holds a key and never composes a system prompt. It
asks the host for what it shows, over the versioned broker described in
[`docs/host-protocol.md`](docs/host-protocol.md).

## Trust, honestly

There is **no sandbox**. A surface is code the human chose to install, running in a frame. The
broker narrows what Chat can *ask for* — a closed list of operations, no arbitrary invoke, no raw
filesystem read — but it is not a security boundary against hostile code, and this README does
not claim one.

## Layout

```text
surface.json          the manifest the host parser reads
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
