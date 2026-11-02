export const ERROR_CODES = [
  "malformed_request",
  "unknown_operation",
  "protocol_mismatch",
  "unregistered_frame",
  "stale_view",
  "forbidden_scope",
  "not_found",
  "invalid_input",
  "cursor_expired",
  "budget_exhausted",
  "host_unavailable",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const MESSAGES: Record<ErrorCode, string> = {
  malformed_request: "the host could not read the request",
  unknown_operation: "the host accepts no such operation",
  protocol_mismatch: "this Chat and the running Ponpoko speak different protocols",
  unregistered_frame: "the host does not know which surface sent this",
  stale_view: "this Chat tab was replaced by a newer one",
  forbidden_scope: "the request reached outside what this Chat may touch",
  not_found: "the thing the request names is not here",
  invalid_input: "the request carried an argument the host refuses",
  cursor_expired: "the host no longer holds the events from that cursor",
  budget_exhausted: "the work has no allowance left",
  host_unavailable: "the host cannot answer right now",
};

export class HostError extends Error {
  readonly code: ErrorCode | "transport";

  readonly retryable: boolean;

  readonly cursor: number | null;

  constructor(code: ErrorCode | "transport", message: string, retryable: boolean, cursor: number | null = null) {
    super(message);
    this.name = "HostError";
    this.code = code;
    this.retryable = retryable;
    this.cursor = cursor;
  }

  get recovery(): string {
    if (this.code === "protocol_mismatch") {
      return "Update the Chat surface, or restart Ponpoko so both sides run the same protocol.";
    }
    if (this.code === "stale_view") {
      return "Reload this tab — a newer Chat took over the conversation.";
    }
    if (this.code === "cursor_expired") {
      return "The list was refreshed from the host instead of from a stale cursor.";
    }
    if (this.retryable) return "Try again; the host said the request may succeed next time.";
    return "Ponpoko said this request cannot be retried as it stands.";
  }
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export function errorMessageFor(code: ErrorCode): string {
  return MESSAGES[code];
}

export function hostErrorFrom(body: unknown): HostError {
  if (typeof body !== "object" || body === null) {
    return new HostError("transport", "the host refused the request and did not say why", false);
  }
  const candidate = body as { code?: unknown; message?: unknown; retryable?: unknown; cursor?: unknown };
  const rawCode = typeof candidate.code === "string" ? candidate.code.trim() : "";
  const code = isErrorCode(rawCode) ? rawCode : "transport";
  const said = typeof candidate.message === "string" ? candidate.message.trim() : "";
  const message = said.length > 0 ? said : code === "transport" ? "the host refused the request" : errorMessageFor(code as ErrorCode);
  const cursor = typeof candidate.cursor === "number" && Number.isFinite(candidate.cursor) ? candidate.cursor : null;
  return new HostError(code, message, candidate.retryable === true, cursor);
}

export function transportError(message: string): HostError {
  return new HostError("transport", message, true);
}
