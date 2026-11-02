const { describe, test, expect } = await import("bun:test");

const { DEFAULT_FLUSH_INTERVAL_MS, createDeltaBatcher } = await import(
  "../src/chat/streamBuffer"
);

function harness(intervalMs = 50) {
  let queued = null;
  let clock = 0;
  const batches = [];
  const batcher = createDeltaBatcher({
    intervalMs,
    now: () => clock,
    schedule: (callback) => {
      queued = callback;
      return 1;
    },
    cancel: () => {
      queued = null;
    },
    onFlush: (pending) => batches.push([...pending.entries()]),
  });
  return {
    batcher,
    batches,
    advance(ms) {
      clock += ms;
      const callback = queued;
      queued = null;
      callback?.();
    },
    queued: () => queued !== null,
  };
}

describe("streamed text is batched, not rendered per character", () => {
  test("the default interval is the documented one", () => {
    expect(DEFAULT_FLUSH_INTERVAL_MS).toBe(50);
  });

  test("text pushed for one request is joined before it is flushed", () => {
    const h = harness();
    h.batcher.push("a", "he");
    h.batcher.push("a", "llo");
    expect(h.batcher.pending()).toBe(5);
    h.advance(60);
    expect(h.batches).toEqual([[["a", "hello"]]]);
  });

  test("two requests in the same frame are flushed together", () => {
    const h = harness();
    h.batcher.push("a", "one");
    h.batcher.push("b", "two");
    h.advance(60);
    expect(h.batches[0]).toEqual([
      ["a", "one"],
      ["b", "two"],
    ]);
  });

  test("the first frame flushes at once, then the interval throttles the rest", () => {
    const h = harness();
    h.batcher.push("a", "x");
    h.advance(10);
    expect(h.batches).toHaveLength(1);
    h.batcher.push("a", "y");
    h.advance(10);
    expect(h.batches).toHaveLength(1);
    h.advance(45);
    expect(h.batches).toHaveLength(2);
  });

  test("a flush clears the buffer and reports it empty", () => {
    const h = harness();
    h.batcher.push("a", "text");
    h.batcher.flush();
    expect(h.batcher.pending()).toBe(0);
    expect(h.batches).toEqual([[["a", "text"]]]);
  });

  test("flushing twice does not send the same text twice", () => {
    const h = harness();
    h.batcher.push("a", "once");
    h.batcher.flush();
    h.batcher.flush();
    expect(h.batches).toHaveLength(1);
  });

  test("empty text is not buffered at all", () => {
    const h = harness();
    h.batcher.push("a", "");
    expect(h.batcher.pending()).toBe(0);
    h.batcher.flush();
    expect(h.batches).toHaveLength(0);
  });

  test("a disposed batcher sends nothing more", () => {
    const h = harness();
    h.batcher.push("a", "text");
    h.batcher.dispose();
    expect(h.batcher.pending()).toBe(0);
    h.batcher.push("a", "more");
    h.advance(100);
    expect(h.batches).toHaveLength(0);
  });
});
