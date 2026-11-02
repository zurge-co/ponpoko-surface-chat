const { describe, test, expect } = await import("bun:test");
const { Broker, readTokens, REQUEST_TIMEOUT_MS } = await import("../src/bridge/broker");
const { memoryTransport } = await import("../src/bridge/transport");
const { BROKER_CHANNEL, HELLO_CONTROL, READY_CONTROL } = await import(
  "../src/contracts/protocol"
);
const { HostError } = await import("../src/contracts/errors");

const VIEW = "a".repeat(32);

function hello(protocol: number, view = VIEW) {
  return {
    channel: BROKER_CHANNEL,
    view,
    control: HELLO_CONTROL,
    protocol,
    doors: ["host.conversation"],
  };
}

function answer(requestId: string, result: unknown, view = VIEW) {
  return { channel: BROKER_CHANNEL, view, request_id: requestId, ok: true, result };
}

function refusal(requestId: string, code: string, retryable = false, view = VIEW) {
  return {
    channel: BROKER_CHANNEL,
    view,
    request_id: requestId,
    ok: false,
    error: { code, message: `${code} happened`, retryable },
  };
}

function broker(helloTimeoutMs = 6000) {
  const transport = memoryTransport();
  const ids = ["r1", "r2", "r3", "r4"];
  let index = 0;
  const instance = new Broker({
    view: VIEW,
    transport,
    newId: () => ids[index++] ?? `r${index}`,
    timeoutMs: 40,
    helloTimeoutMs,
  });
  return { transport, instance };
}

describe("broker handshake", () => {
  test("announces ready with the view token as soon as it starts", () => {
    const { transport, instance } = broker();
    instance.start();
    instance.stop();
    expect(transport.sent[0]).toMatchObject({
      channel: BROKER_CHANNEL,
      view: VIEW,
      control: READY_CONTROL,
    });
  });

  test("keeps no hello until the host greets this exact view", async () => {
    const { transport, instance } = broker();
    instance.start();
    transport.deliver(hello(2, "b".repeat(32)));
    expect(instance.helloView()).toBeNull();
    const pending = instance.awaitHello();
    transport.deliver(hello(1));
    expect(await pending).toEqual({ protocol: 1, doors: ["host.conversation"] });
    instance.stop();
  });

  test("a host that never greets fails the handshake instead of hanging", async () => {
    const { instance } = broker(30);
    instance.start();
    const failed = instance.awaitHello();
    await expect(failed).rejects.toBeInstanceOf(HostError);
    instance.stop();
  });

  test("answers are attributed by request id, and a foreign view is never read", async () => {
    const { transport, instance } = broker();
    instance.start();
    const first = instance.call("host.conversation", "threads.list");
    const second = instance.call("host.conversation", "threads.list");
    expect(transport.sent[1]).toMatchObject({
      namespace: "host.conversation",
      operation: "threads.list",
      request_id: "r1",
    });
    transport.deliver(answer("r1", [{ thread_id: "stolen" }], "c".repeat(32)));
    transport.deliver(answer("r2", [{ thread_id: "t2" }]));
    transport.deliver(answer("r1", [{ thread_id: "t1" }]));
    expect(await first).toEqual([{ thread_id: "t1" }]);
    expect(await second).toEqual([{ thread_id: "t2" }]);
    instance.stop();
  });

  test("an unrecognized channel is never mistaken for the broker", async () => {
    const { transport, instance } = broker();
    instance.start();
    const pending = instance.call("host.conversation", "protocol.info");
    transport.deliver({
      channel: "unrecognized.surface",
      view: VIEW,
      request_id: "r1",
      ok: true,
      result: { protocol: 1 },
    });
    await expect(pending).rejects.toBeInstanceOf(HostError);
    instance.stop();
  });
});

describe("broker failures", () => {
  test("a typed error keeps its code, message and retryability", async () => {
    const { transport, instance } = broker();
    instance.start();
    const pending = instance.call("host.conversation", "messages.list");
    transport.deliver(refusal("r1", "cursor_expired", true));
    const error = await pending.catch((e) => e);
    expect(error).toBeInstanceOf(HostError);
    expect(error.code).toBe("cursor_expired");
    expect(error.retryable).toBe(true);
    expect(error.message).toBe("cursor_expired happened");
    instance.stop();
  });

  test("an unknown error code is reported as a transport failure, never invented", async () => {
    const { transport, instance } = broker();
    instance.start();
    const pending = instance.call("host.conversation", "messages.list");
    transport.deliver(refusal("r1", "who_knows"));
    const error = await pending.catch((e) => e);
    expect(error.code).toBe("transport");
    instance.stop();
  });

  test("a silent host fails the call after the deadline instead of waiting forever", async () => {
    const { instance } = broker();
    instance.start();
    const started = Date.now();
    const error = await instance.call("host.conversation", "threads.list").catch((e) => e);
    expect(error).toBeInstanceOf(HostError);
    expect(error.code).toBe("transport");
    expect(Date.now() - started).toBeLessThan(REQUEST_TIMEOUT_MS);
    instance.stop();
  });

  test("stopping rejects every pending call and drops the subscription", async () => {
    const { transport, instance } = broker();
    instance.start();
    const pending = instance.call("host.conversation", "threads.list");
    instance.stop();
    await expect(pending).rejects.toBeInstanceOf(HostError);
    const seen: unknown[] = [];
    instance.onEvent((event) => seen.push(event));
    transport.deliver({
      channel: BROKER_CHANNEL,
      view: VIEW,
      event_id: "e1",
      seq: 1,
      type: "delta",
      timestamp: 1,
    });
    expect(seen).toEqual([]);
  });
});

describe("broker events", () => {
  function event(id: string, seq: number, type = "delta") {
    return {
      channel: BROKER_CHANNEL,
      view: VIEW,
      event_id: id,
      seq,
      type,
      timestamp: 1,
      thread_id: "t1",
      payload: { text: "hi" },
    };
  }

  test("an event replayed after a reconnect is delivered once", () => {
    const { transport, instance } = broker();
    instance.start();
    const seen: string[] = [];
    instance.onEvent((row) => seen.push(row.event_id));
    transport.deliver(event("e1", 1));
    transport.deliver(event("e1", 1));
    transport.deliver(event("e2", 2));
    expect(seen).toEqual(["e1", "e2"]);
    instance.stop();
  });

  test("two threads may carry the same event id without one hiding the other", () => {
    const { transport, instance } = broker();
    instance.start();
    const seen: string[] = [];
    instance.onEvent((row) => seen.push(row.thread_id ?? ""));
    transport.deliver(event("e1", 1));
    transport.deliver({ ...event("e1", 1), thread_id: "t2" });
    expect(seen).toEqual(["t1", "t2"]);
    instance.stop();
  });
});

describe("broker doors", () => {
  test("only a well formed token bag reaches the frame", () => {
    expect(readTokens({ base: "#241811" })).toEqual({ base: "#241811" });
    expect(readTokens({ base: 12 })).toBeNull();
    expect(readTokens(null)).toBeNull();
  });

  test("a drop reaches only the registered handler and drops empty paths", () => {
    const { transport, instance } = broker();
    instance.start();
    const seen: string[][] = [];
    instance.onDrop((paths) => seen.push([...paths]));
    transport.deliver({
      channel: BROKER_CHANNEL,
      view: VIEW,
      control: "ponpoko.host.drop",
      paths: ["/tmp/a.png", ""],
    });
    expect(seen).toEqual([["/tmp/a.png"]]);
    instance.stop();
  });
});

describe("palette delivery", () => {
  test("late subscribers receive the current palette and stale frames cannot replace it", () => {
    const { transport, instance } = broker();
    instance.start();
    const palette = { channel: BROKER_CHANNEL, view: VIEW, control: "ponpoko.host.palette", tokens: { base: "#e6e9dc", accent: "#3c702f" } };
    transport.deliver(palette);
    const seen: Record<string, string>[] = [];
    const off = instance.onPalette((tokens) => seen.push(tokens));
    expect(seen).toEqual([palette.tokens]);
    transport.deliver({ ...palette, view: "another", tokens: { base: "#ffffff" } });
    expect(seen).toHaveLength(1);
    transport.deliver({ ...palette, tokens: { base: "#241811" } });
    expect(seen.at(-1)).toEqual({ base: "#241811" });
    off();
    instance.stop();
  });
});
