# Chat protocol and ownership

All surfaces use channel `ponpoko.surface.v1` and protocol 1. No other surface protocol is accepted.
The frame performs ready/hello and receives palette updates through the common broker.

Requests carry `channel`, `view`, `request_id`, `namespace`, `operation`, and optional object
`payload`. Answers carry the same view/request ID and either `result` or a typed `error`.

## Conversation calls

Chat calls `host.surface` operation `backend.call`, with `{ method, params }`.
`surface.json` declares the complete method list. Host checks that declaration and routes to
the installed backend; it does not interpret thread IDs, messages, prompts or stream cursors.
The backend speaks newline-delimited JSON-RPC 2.0 on stdin/stdout, like Editor and Terminal.

Methods cover `threads.*`, `messages.*`, `message.send`, `turn.cancel`, `stream.events/snapshot`,
`providers.list`, `preferences.list/set`, and `app.info`. `stream.events` returns durable,
ordered per-thread events after a sequence cursor. Events are polled by Chat itself and survive
backend restarts. Host has no conversation event subscription or transcript broadcast.

Chat reads the authoritative stored transcript for a turn, supplies its own prompt and delegates
to the common Host work runner. The backend records the runtime work ID before observing its
result, persists delta/tool events with its cursor, and saves final messages atomically.
Only one turn may mutate a conversation at a time. Editing or deleting it while a turn is active
is refused. Stop requests stop that existing work. Restart inspects existing work; uncertain
starts are looked up by idempotent request ID and never replayed automatically.

## Generic Host services

`host.platform`: `protocol.info`, `providers.list`, `attachments.pick/read/paste-image`,
`files.save`, `preferences.list`, `settings.open`, `link.open`.
`host.surface`: `tool.file`, `tool.paste`, `backend.call`.
`host.work`: common work lifecycle operations. All installed identities receive the same doors.

The backend receives `PONPOKO_SURFACE_ID`, `PONPOKO_SURFACE_DATA_DIR`, `PONPOKO_HOST_CONTROL`,
and the transitional `PONPOKO_HOST_DATABASE` import source. The control file names an
authenticated loopback endpoint using protocol 1 and Bearer authorization. Runtime requests
use verb `runtime`, the installed surface ID, and `extra.operation`:
`providers`, `preferences`, `start`, `lookup`, `status`, `events`, `stop`.
Requests declare `contract_version: 1`. `start` takes an `input` with a request ID,
provider-neutral input/output modalities, system prompt, messages, explicit
rounds/seconds/output_bytes allowances and with_tools. Other work operations use work_id;
lookup uses request_id; events also uses after. These are generic services available equally
to every installed backend. Credentials remain in Host.

## Durable data

The backend uses `chat.sqlite3` under its supplied data directory, with SQLite WAL, foreign
keys and a busy timeout. A one-time read-only import copies legacy thread/message IDs,
ordering, settings, metadata and timestamps in one transaction and records a migration ledger.
Conflicts or storage failures are reported; no import is marked complete after rollback.
Uninstall/reinstall never removes this directory. The Host database is not used for ongoing
conversation reads or writes after import.
