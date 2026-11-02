import { HostError, hostErrorFrom, transportError } from "../contracts/errors";
import {
  BROKER_CHANNEL,
  HELLO_CONTROL,
  PALETTE_CONTROL,
  READY_CONTROL,
  requestFor,
  type BrokerControl,
  type BrokerEvent,
  type BrokerResponse,
  type Namespace,
} from "../contracts/protocol";
import { newRequestId, type Transport } from "./transport";

export const REQUEST_TIMEOUT_MS = 20_000;

export const HANDSHAKE_TIMEOUT_MS = 6_000;

export type EventHandler = (event: BrokerEvent) => void;

export interface PaletteHandler {
  (tokens: Record<string, string>): void;
}

export interface DropHandler {
  (paths: readonly string[]): void;
}

export interface HelloView {
  protocol: number;
  doors: readonly string[];
}

export interface BrokerOptions {
  view: string;
  transport: Transport;
  timeoutMs?: number;
  helloTimeoutMs?: number;
  newId?: () => string;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: HostError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Broker {
  readonly view: string;

  private readonly transport: Transport;

  private readonly timeoutMs: number;

  private readonly helloTimeoutMs: number;

  private readonly newId: () => string;

  private readonly pending = new Map<string, Pending>();

  private readonly stopHandlers = new Set<() => void>();

  private readonly eventHandlers = new Set<EventHandler>();

  private palette: Record<string, string> | null = null;

  private readonly paletteHandlers = new Set<PaletteHandler>();

  private readonly dropHandlers = new Set<DropHandler>();

  private hello: HelloView | null = null;

  private helloWaiters: { resolve: (view: HelloView) => void; reject: (error: HostError) => void; timer: ReturnType<typeof setTimeout> }[] = [];

  private unsubscribe: (() => void) | null = null;

  private seen = new Set<string>();

  constructor(options: BrokerOptions) {
    this.view = options.view;
    this.transport = options.transport;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.helloTimeoutMs = options.helloTimeoutMs ?? HANDSHAKE_TIMEOUT_MS;
    this.newId = options.newId ?? newRequestId;
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe((message) => this.receive(message));
    this.transport.post({ channel: BROKER_CHANNEL, view: this.view, control: READY_CONTROL });
  }

  stop(): void {
    for (const handler of this.stopHandlers) handler();
    this.stopHandlers.clear();
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(transportError("this Chat closed before the host answered"));
      this.pending.delete(id);
    }
    this.seen.clear();
  }

  helloView(): HelloView | null {
    return this.hello;
  }

  awaitHello(): Promise<HelloView> {
    if (this.hello) return Promise.resolve(this.hello);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.helloWaiters = this.helloWaiters.filter((waiter) => waiter.timer !== timer);
        reject(
          new HostError(
            "host_unavailable",
            "Ponpoko did not answer the handshake — the surface frame is open but the host did not say hello",
            true,
          ),
        );
      }, this.helloTimeoutMs);
      this.helloWaiters.push({ resolve, reject, timer });
    });
  }

  onStop(handler: () => void): () => void {
    this.stopHandlers.add(handler);
    return () => this.stopHandlers.delete(handler);
  }

  emitBackendEvent(event: BrokerEvent): void {
    for (const handler of this.eventHandlers) handler(event);
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onPalette(handler: PaletteHandler): () => void {
    this.paletteHandlers.add(handler);
    if (this.palette) handler(this.palette);
    return () => this.paletteHandlers.delete(handler);
  }

  onDrop(handler: DropHandler): () => void {
    this.dropHandlers.add(handler);
    return () => this.dropHandlers.delete(handler);
  }

  call<T>(namespace: Namespace, operation: string, payload?: unknown): Promise<T> {
    const requestId = this.newId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          transportError(
            `${namespace}.${operation} got no answer within ${Math.round(this.timeoutMs / 1000)}s — the host may be busy`,
          ),
        );
      }, this.timeoutMs);
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      this.transport.post(requestFor(this.view, requestId, namespace, operation, payload));
    });
  }

  private receive(message: unknown): void {
    if (typeof message !== "object" || message === null) return;
    const candidate = message as Record<string, unknown>;
    if (candidate.channel !== BROKER_CHANNEL || candidate.view !== this.view) return;

    if (typeof candidate.control === "string") {
      this.control(candidate as unknown as BrokerControl);
      return;
    }

    if (typeof candidate.request_id === "string") {
      this.answer(candidate as unknown as BrokerResponse);
      return;
    }

    if (typeof candidate.event_id === "string") {
      this.event(candidate as unknown as BrokerEvent);
    }
  }

  private control(message: BrokerControl): void {
    if (message.control === HELLO_CONTROL) {
      const protocol = typeof message.protocol === "number" ? message.protocol : 0;
      const doors = Array.isArray(message.doors)
        ? message.doors.filter((door): door is string => typeof door === "string")
        : [];
      this.hello = { protocol, doors };
      const waiters = this.helloWaiters;
      this.helloWaiters = [];
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve(this.hello);
      }
      return;
    }
    if (message.control === PALETTE_CONTROL) {
      const tokens = readTokens(message.tokens);
      if (tokens) {
        this.palette = tokens;
        for (const handler of this.paletteHandlers) handler(tokens);
      }
      return;
    }
    if (typeof message.control === "string" && message.control.endsWith(".drop")) {
      const paths = Array.isArray(message.paths)
        ? message.paths.filter((path): path is string => typeof path === "string" && path.length > 0)
        : [];
      for (const handler of this.dropHandlers) handler(paths);
    }
  }

  private answer(message: BrokerResponse): void {
    const pending = this.pending.get(message.request_id);
    if (!pending) return;
    this.pending.delete(message.request_id);
    clearTimeout(pending.timer);
    if (message.ok === true) {
      pending.resolve(message.result);
      return;
    }
    pending.reject(hostErrorFrom(message.error));
  }

  private event(message: BrokerEvent): void {
    const scope = message.work_id ?? message.thread_id ?? "";
    const key = `${scope}#${message.event_id}#${message.seq}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 4000) {
      const [oldest] = this.seen;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    for (const handler of this.eventHandlers) handler(message);
  }
}

export function readTokens(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null) return null;
  const tokens: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") tokens[key] = entry;
  }
  return Object.keys(tokens).length > 0 ? tokens : null;
}
