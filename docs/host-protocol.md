# The host protocol this Chat speaks

Chat is an installed surface. It owns its UI, its Markdown and PonpokoUI renderers, and its
presentation preferences. Everything durable — threads, messages, providers, keys, the model
and tool loop, the composed system prompt — belongs to Ponpoko's host. The page therefore talks
to exactly one thing: the versioned broker in `src/bridge/`, over `postMessage` inside its frame.

Nothing here is Tauri: the bundle contains no `@tauri-apps` import, no `__TAURI_INTERNALS__`,
no key material and no system prompt it composes itself.

## Channel and handshake

| Step | Direction | Message |
| --- | --- | --- |
| ready | surface → host | `{ channel: "ponpoko.surface.v1", view, control: "ponpoko.surface.ready" }` |
| hello | host → surface | `{ channel, view, control: "ponpoko.host.hello", protocol: 1, doors: [...] }` |
| info | surface → host | `host.conversation.protocol.info` → `{ protocol, host_version, identity }` |

The view token comes from `?view=` on the frame URL. A message for another view is dropped
unread, so a stale frame can never answer for a live one. If the host's `protocol` and this
bundle's `PROTOCOL_VERSION` differ, Chat renders the mismatch screen and reads nothing else.

Every installed surface uses this same channel and request envelope. `host.surface` provides
`tool.file`, `tool.paste` and `backend.call`; Chat and work add their scoped namespaces.
There is no alternate protocol or legacy envelope.

## Three namespaces, closed unions

`src/contracts/protocol.ts` is the single source of truth. A request names a namespace and an
operation from a closed list; there is no free-form verb, no `invoke`, and no shell escape.

`host.conversation`: `protocol.info`, `threads.list|create|update|rename|pin|delete|search|export`,
`messages.list|append|truncate`, `message.send`, `stream.subscribe|unsubscribe`, `turn.cancel`,
`providers.list`, `attachments.pick|read|paste-image`, `preferences.list|set`,
`settings.open`, `link.open`.

`host.work`: `list`, `get`, `events.subscribe|unsubscribe`, `instruction.append`,
`pause|resume|stop`. Chat reads the work a workspace is doing so a conversation can point at the
surface it produced; it never runs the loop itself.

## Request and answer

```json
{ "channel": "ponpoko.surface.v1", "view": "<token>", "request_id": "<id>",
  "namespace": "host.conversation", "operation": "threads.list", "payload": { "…": "…" } }
```

```json
{ "channel": "ponpoko.surface.v1", "view": "<token>", "request_id": "<id>",
  "ok": true, "result": [] }
```

A refusal carries a typed body, never a bare string:

```json
{ "ok": false, "error": { "code": "cursor_expired", "message": "…", "retryable": true } }
```

`src/contracts/errors.ts` lists every code and gives each one a recovery sentence the human can
act on. A code the host does not declare degrades to a `transport` failure rather than being
echoed as if the host had said it.

## Events

```json
{ "channel": "ponpoko.surface.v1", "view": "<token>", "event_id": "<id>", "seq": 12,
  "type": "delta", "timestamp": 1730000000, "thread_id": "…", "payload": { "request_id": "…", "text": "…" } }
```

Chat reads `delta`, `tool`, `done`, `failed`, `cancelled`, `providers-changed` and
`threads-changed`. Events are deduplicated on `(scope, event_id, seq)` where the scope is the
work or the thread, so replaying a cursor after a reload never doubles a token and two threads
carrying the same event id never hide each other.

`stream.subscribe` answers with the cursor the host is at, and a `cursor_expired` refusal means
the page must reload the transcript through `messages.list` instead of trusting a stale cursor.

## Identity

`protocol.info.identity` names the installed surface registered for this live frame. It is
not an authorization tier. Chat, Editor and custom bundles receive the same host service APIs;
no name, repository or installer provenance grants privileged access. The host still checks
view ownership, request scope, protocol, operation and subscription on every call. Credentials
and trusted prompt composition remain in the host.
