export interface Transport {
  post(message: unknown): void;
  subscribe(handler: (message: unknown) => void): () => void;
}

export function parentTransport(target: Window | null = window.parent): Transport {
  return {
    post: (message) => {
      target?.postMessage(message, "*");
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        if (event.source !== target) return;
        handler(event.data);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
  };
}

export function memoryTransport(): Transport & { sent: unknown[]; deliver: (message: unknown) => void } {
  const handlers = new Set<(message: unknown) => void>();
  return {
    sent: [],
    post(message) {
      this.sent.push(message);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    deliver(message) {
      for (const handler of handlers) handler(message);
    },
  };
}

export function viewTokenFromLocation(url: Location | URL): string {
  try {
    return new URL(url.toString()).searchParams.get("view")?.trim() ?? "";
  } catch {
    return "";
  }
}

export function newRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
