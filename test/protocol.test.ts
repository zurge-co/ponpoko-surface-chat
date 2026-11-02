const { describe, test, expect } = await import("bun:test");
const protocol = await import("../src/contracts/protocol");
const { ERROR_CODES, hostErrorFrom } = await import("../src/contracts/errors");
const types = await import("../src/contracts/types");

describe("closed operation unions", () => {
  test("every namespace lists a closed set of operations with no duplicate", () => {
    for (const namespace of protocol.NAMESPACES) {
      const operations = protocol.OPERATIONS[namespace];
      expect(new Set(operations).size).toBe(operations.length);
      expect(operations.length).toBeGreaterThan(0);
    }
  });

  test("no operation may be smuggled into another namespace", () => {
    const chatOnly = protocol.CHAT_OPERATIONS.filter(
      (name) => !(protocol.WORK_OPERATIONS as readonly string[]).includes(name),
    );
    expect(chatOnly.length).toBe(protocol.CHAT_OPERATIONS.length);
    for (const operation of protocol.WORK_OPERATIONS) {
      expect(protocol.isOperation("host.chat", operation)).toBe(false);
    }
  });

  test("nothing broad enough to run arbitrary host work is reachable", () => {
    const forbidden = ["invoke", "execute", "run", "eval", "shell", "read", "write-file", "ipc"];
    for (const namespace of protocol.NAMESPACES) {
      for (const operation of protocol.OPERATIONS[namespace]) {
        expect(forbidden).not.toContain(operation);
      }
    }
  });

  test("a namespace and its operation are both required to name a call", () => {
    expect(protocol.isNamespace("host.chat")).toBe(true);
    expect(protocol.isNamespace("host.everything")).toBe(false);
    expect(protocol.isOperation("host.chat", "threads.list")).toBe(true);
    expect(protocol.isOperation("host.chat", "threads.nuke")).toBe(false);
  });

  test("one channel and protocol serve every surface", () => {
    expect(protocol.BROKER_CHANNEL).toBe("ponpoko.surface.v1");
    expect(protocol.PROTOCOL_VERSION).toBe(1);
    expect(protocol.isBrokerChannel(protocol.BROKER_CHANNEL)).toBe(true);
    expect(protocol.isBrokerChannel("ponpoko.surface.v0")).toBe(false);
  });

  test("a request carries the view, a request id and no free-form verb", () => {
    const request = protocol.requestFor("view-a", "r1", "host.chat", "threads.list", { a: 1 });
    expect(request).toEqual({
      channel: protocol.BROKER_CHANNEL,
      view: "view-a",
      request_id: "r1",
      namespace: "host.chat",
      operation: "threads.list",
      payload: { a: 1 },
    });
    expect("verb" in request).toBe(false);
  });

  test("a payload-less request omits the field rather than sending undefined", () => {
    const request = protocol.requestFor("view-a", "r1", "host.work", "list");
    expect("payload" in request).toBe(false);
  });
});

describe("typed errors", () => {
  test("every declared code has a message the human can read", () => {
    for (const code of ERROR_CODES) {
      const error = hostErrorFrom({ code, message: "", retryable: false });
      expect(error.code).toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.recovery.length).toBeGreaterThan(0);
    }
  });

  test("an undeclared code is never passed through as if the host had named it", () => {
    const error = hostErrorFrom({ code: "made_up", message: "nope", retryable: true });
    expect(error.code).toBe("transport");
    expect(ERROR_CODES).not.toContain(error.code);
  });

  test("a spoofed manifest id has its own recovery, not a generic retry", () => {
    const error = hostErrorFrom({ code: "not_official_install", message: "no", retryable: false });
    expect(error.recovery).toContain("Install Chat from Ponpoko itself");
    expect(error.retryable).toBe(false);
  });
});

describe("reading host rows", () => {
  test("a missing field becomes an empty value, never undefined in the view", () => {
    const thread = types.readThread({ thread_id: "t1" });
    expect(thread).toEqual({
      thread_id: "t1",
      title: "",
      style_id: "",
      system_prompt: "",
      provider_id: null,
      pinned: false,
      created_at: 0,
      updated_at: 0,
    });
    expect(Object.values(thread).every((value) => value !== undefined)).toBe(true);
  });

  test("an unknown role is never rendered as the human's own message", () => {
    const message = types.readMessage({ role: "root" });
    expect(message.role).toBe("assistant");
  });

  test("garbage in place of a list reads as no rows instead of throwing", () => {
    expect(types.readThreads(null)).toEqual([]);
    expect(types.readMessages("nope")).toEqual([]);
    expect(types.readSearchHits({})).toEqual([]);
    expect(types.readProviders(undefined)).toEqual([]);
  });

  test("a protocol answer keeps the host's own numbers untouched", () => {
    const info = types.readProtocolInfo({ protocol: 1, host_version: "0.19.4", official: true });
    expect(info.protocol).toBe(1);
    expect(info.official).toBe(true);
    expect(info.install_id).toBeNull();
  });
});
