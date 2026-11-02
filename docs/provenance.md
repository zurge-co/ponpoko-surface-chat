# Provenance of what was moved here

This bundle is a repository of its own. Everything below was copied out of the Ponpoko host
checkout (`/Users/saint/zurge/ponpoko`, commit `86e85c6` plus the surface-workspace work that
followed it) and is maintained here from now on. The host no longer owns these files.

## Copied, then adapted to the broker

| Here | Host origin | What changed |
| --- | --- | --- |
| `src/ponpoko-ui/**` | `app/src/lib/ponpoko-ui/**` | unchanged, vendored: catalog, lexer, parser, evaluator, fence splitter |
| `src/chat/markdown/**` | `app/src/shell/chat/markdown/**` | unchanged |
| `src/chat/highlight/**` | `app/src/shell/chat/highlight/**` | unchanged |
| `src/chat/ponpoko-ui/**` | `app/src/shell/chat/ponpoko-ui/**` | import paths only |
| `src/chat/{MessageRow,MessageList,ThreadRail,ThreadSettings,Composer,ComposerBar,ContextCard,ContextChips,CodeBlock,CopyButton,ChatHeader,ChatSidebar,ChatOverlays,CommandPalette,Welcome,Poko,PokoThinking}.tsx` | same names under `app/src/shell/chat/` | imports repointed at `../contracts/types` and this bundle's own lib |
| `src/chat/{context,history,navigation,streamBuffer,titles,types,a11y,paste,useToast}.ts` | same names | unchanged; still client-only |
| `src/styles/app.css` | `app/src/index.css` | the palette tokens, `.md-content`, syntax classes and the mascot motion only; the host shell's layout rules stayed behind |

The PonpokoUI catalogue, lexer, parser and evaluator move with **provenance, not ownership**:
the host still ships the same compiler for its own replies, and the two copies must agree. The
tests that pinned them in the host came across too — `test/ponpoko-ui.*.test.ts`,
`test/markdown.test.ts`, `test/highlight.test.ts`, `test/history.test.ts`,
`test/navigation.test.ts`, `test/context.test.ts` and `test/streamBuffer.test.ts` — so the same
laws are proven on this side of the move.

## Rewritten against the broker

| Here | Host origin | Why it is not a copy |
| --- | --- | --- |
| `src/app/host.ts` | `app/src/lib/shellCore/chat_api.ts`, `stream_api.ts`, `llm_api.ts` | every `invoke()` became a `host.chat` operation; there is no Tauri IPC in a surface |
| `src/bridge/**` | `app/src/lib/surfaceBridge.ts` (host side of the old door) | the door verbs are replaced by the two namespaces of `docs/host-protocol.md` |
| `src/chat/useChatThreads.ts` | same name | `listen("chat://…")` became `broker.onEvent`; storage preferences moved to `src/lib/prefs.ts` |
| `src/chat/useChatStream.ts` | same name | the stream now arrives as broker events; the system prompt is composed by the host, not here |
| `src/chat/useChatContext.ts` | same name | file dialogs, drag-and-drop and image paste became `attachments.*` operations and the host's drop control |
| `src/chat/{Welcome,PokoSetup}.tsx` | same names | provider/key setup stays in the host: these only open the host settings window |
| `src/chat/usePonpokoActions.ts` | same name | `open_external_url` became `host.chat.link.open` |
| `src/lib/chatStyles.ts` | `app/src/lib/prompts/styles.ts` | the style list and preambles the UI shows; the host composes the actual system prompt |
| `src/lib/modelLabel.ts` | `app/src/lib/modelSetup.ts` | provider display metadata only — never a credential |
| `src/lib/{poko,time,theme,mediaQuery,clipboard,prefs}.ts` | same names under `app/src/lib/` | unchanged or trimmed to what a surface needs |

## Deliberately left in the host

Provider credentials and OAuth, the model and tool loop, checkpoints, the composed system
prompt, the central transcript database, install/storage/Git, and every `@tauri-apps` import.
Chat opens the host's settings window for providers and shows provider *display* metadata; it
never sees a key.

## Licence

The host repository declares no licence file at the commit above, so no licence is asserted for
the source moved here. `LICENSE` says exactly that and must be replaced only after the host's own
licence is decided — inventing one here would be a claim this repository cannot make.
