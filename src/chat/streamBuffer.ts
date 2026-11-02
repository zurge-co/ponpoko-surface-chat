export interface DeltaBatcherOptions {
  onFlush: (pending: Map<string, string>) => void;
  intervalMs?: number;
  schedule?: (callback: () => void) => number;
  cancel?: (handle: number) => void;
  now?: () => number;
}

export interface DeltaBatcher {
  push: (requestId: string, text: string) => void;
  flush: () => void;
  pending: () => number;
  dispose: () => void;
}

export const DEFAULT_FLUSH_INTERVAL_MS = 50;

export function createDeltaBatcher(options: DeltaBatcherOptions): DeltaBatcher {
  const intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_FLUSH_INTERVAL_MS);
  const now = options.now ?? (() => Date.now());
  const schedule =
    options.schedule ??
    ((callback: () => void) => {
      if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
      return setTimeout(callback, 16) as unknown as number;
    });
  const cancel =
    options.cancel ??
    ((handle: number) => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
      else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    });

  let buffer = new Map<string, string>();
  let handle: number | null = null;
  let lastFlush = -Infinity;
  let disposed = false;

  const release = () => {
    handle = null;
    if (buffer.size === 0) return;
    const batch = buffer;
    buffer = new Map();
    lastFlush = now();
    options.onFlush(batch);
  };

  const scheduleFlush = () => {
    if (disposed || handle !== null) return;
    handle = schedule(() => {
      handle = null;
      if (disposed) return;
      const elapsed = now() - lastFlush;
      if (elapsed < intervalMs) {
        scheduleFlush();
        return;
      }
      release();
    });
  };

  return {
    push(requestId, text) {
      if (disposed || !text) return;
      buffer.set(requestId, (buffer.get(requestId) ?? "") + text);
      scheduleFlush();
    },
    flush() {
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      release();
    },
    pending() {
      let total = 0;
      for (const text of buffer.values()) total += text.length;
      return total;
    },
    dispose() {
      disposed = true;
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      buffer.clear();
    },
  };
}
