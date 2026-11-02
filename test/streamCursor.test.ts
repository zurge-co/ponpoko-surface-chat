const { describe, test, expect } = await import("bun:test");
const { accept, batch, newCursor, planCatchUp, readExpiredCursor, readSubscribeAnswer } =
  await import("../src/chat/streamCursor");
const { Broker } = await import("../src/bridge/broker");
const { memoryTransport } = await import("../src/bridge/transport");
const { BROKER_CHANNEL, HELLO_CONTROL } = await import("../src/contracts/protocol");

const VIEW = "b".repeat(32);

function event(seq: number, threadId = "t-1", text = `d${seq}`) {
  return {
    channel: BROKER_CHANNEL,
    view: VIEW,
    event_id: `${threadId}:${seq}`,
    seq,
    type: "delta",
    timestamp: 1,
    thread_id: threadId,
    payload: { text },
  };
}

describe("the Chat surface keeps its own place in the stream", () => {
  test("a replayed event is delivered once and the cursor only moves forward", () => {
    const cursor = newCursor("t-1");
    expect(batch(cursor, [event(1), event(2), event(3)])).toHaveLength(3);
    expect(cursor.seq).toBe(3);
    expect(batch(cursor, [event(2), event(3)])).toEqual([]);
    expect(cursor.seq).toBe(3);
    expect(batch(cursor, [event(4)])).toHaveLength(1);
    expect(cursor.seq).toBe(4);
  });

  test("an event for another thread never advances this thread's cursor", () => {
    const cursor = newCursor("t-1");
    expect(batch(cursor, [event(1, "t-2"), event(7, "t-1")])).toHaveLength(1);
    expect(cursor.seq).toBe(7);
    expect(accept(cursor, event(8, "t-2")).accept).toEqual([]);
  });

  test("the same event id is dropped even when it arrives with the same seq twice", () => {
    const cursor = newCursor("t-1");
    const one = event(1);
    expect(accept(cursor, one).accept).toHaveLength(1);
    expect(accept(cursor, { ...one }).duplicate).toBe(1);
    expect(accept(cursor, { ...event(1), event_id: "other:1" }).accept).toHaveLength(1);
  });

  test("memory of what was seen stays bounded, so a long thread cannot grow it without end", () => {
    const cursor = newCursor("t-1");
    for (let seq = 1; seq <= 2_000; seq += 1) accept(cursor, event(seq));
    expect(cursor.seen.size).toBeLessThanOrEqual(512);
    expect(cursor.seq).toBe(2_000);
    expect(accept(cursor, event(2_001)).accept).toHaveLength(1);
    expect(accept(cursor, event(2_001)).accept).toEqual([]);
  });

  test("an expired cursor is turned into a snapshot reload at the head the host named", () => {
    expect(readExpiredCursor({ code: "cursor_expired", cursor: 900 })).toBe(900);
    expect(readExpiredCursor({ code: "invalid_input", cursor: 5 })).toBeNull();
    expect(readExpiredCursor({ code: "cursor_expired" })).toBeNull();
    expect(planCatchUp(12, { code: "cursor_expired", cursor: 900 })).toEqual({
      reloadSnapshot: true,
      cursor: 900,
    });
    expect(planCatchUp(12, { code: "host_unavailable" })).toBeNull();
  });

  test("a subscribe answer is read only when it really carries a cursor", () => {
    expect(readSubscribeAnswer({ cursor: 4, subscription_id: "s-1" })).toEqual({
      cursor: 4,
      subscription_id: "s-1",
    });
    expect(readSubscribeAnswer({ cursor: "4" })).toBeNull();
    expect(readSubscribeAnswer(null)).toBeNull();
  });
});

describe("a reconnect through the real broker loses nothing and repeats nothing", () => {
  test("an expired cursor is refused with the head the surface must reload at", async () => {
    const transport = memoryTransport();
    const broker = new Broker({
      view: VIEW,
      transport,
      newId: () => "r-1",
      timeoutMs: 50,
      helloTimeoutMs: 50,
    });
    broker.start();

    const first = broker.call("host.chat", "stream.subscribe", { thread_id: "t-1", after: 0 });
    const hello = transport.sent.at(-1) as { request_id: string };
    transport.deliver({
      channel: BROKER_CHANNEL,
      view: VIEW,
      control: HELLO_CONTROL,
      protocol: 1,
      doors: ["host.chat.stream.subscribe"],
    });
    transport.deliver({
      channel: BROKER_CHANNEL,
      view: VIEW,
      request_id: hello.request_id,
      ok: true,
      result: { subscription_id: "s-1", thread_id: "t-1", cursor: 3 },
    });
    expect(readSubscribeAnswer(await first)).toEqual({ cursor: 3, subscription_id: "s-1" });

    const second = broker.call("host.chat", "stream.subscribe", { thread_id: "t-1", after: 41 });
    const retry = transport.sent.at(-1) as { request_id: string };
    transport.deliver({
      channel: BROKER_CHANNEL,
      view: VIEW,
      request_id: retry.request_id,
      ok: false,
      error: { code: "cursor_expired", message: "too old", retryable: false, cursor: 900 },
    });
    const failed = await second.then(
      () => null,
      (error: unknown) => error as { code?: string; cursor?: number | null },
    );
    expect(failed?.code).toBe("cursor_expired");
    expect(failed?.cursor).toBe(900);
    expect(planCatchUp(41, failed)).toEqual({ reloadSnapshot: true, cursor: 900 });
    broker.stop();
  });
});
