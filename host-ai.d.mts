export type ModelIo = { "inputs": Array<string>; "outputs": Array<string>;  };
export type InputPart = ({ "type": string; "text"?: string | null; "role"?: "user" | "assistant" | "system" | null; "url"?: string | null; "data_base64"?: string | null; "mime_type"?: string | null; "name"?: string | null; "value"?: unknown;  }) & ({ "text": string; [key: string]: unknown; } | { "url": string; [key: string]: unknown; } | { "data_base64": string; [key: string]: unknown; } | { "value": unknown; [key: string]: unknown; });
export type InferenceOptions = { "temperature"?: number; "max_tokens"?: number; "count"?: number; "dimensions"?: number; "top_n"?: number; "seed"?: number; "speed"?: number; "duration"?: number; "voice"?: string; "format"?: string; "size"?: string; "query"?: string; "language"?: string; "aspect_ratio"?: string; "tools"?: Array<{  [key: string]: unknown; }>;  };
export type InferenceRequest = { "request_id": string; "io": ModelIo; "input": Array<InputPart>; "options"?: InferenceOptions; "stream"?: boolean; "budget": { "seconds": number; "output_bytes": number;  };  };
export type AiEnvelope = { "operation": "contract" | "validate" | "invoke" | "invoke_lookup" | "invoke_status" | "invoke_events" | "invoke_stop" | "invoke_job_status" | "invoke_job_cancel" | "slots" | "usage"; "contract_version": 1; "input"?: InferenceRequest; "request_id"?: string; "after"?: number; "check_setup"?: boolean;  };
export type OutputPart = { "type": string; "text"?: string | null; "url"?: string | null; "data_base64"?: string | null; "mime_type"?: string | null; "value"?: unknown; "index"?: number | null; [key: string]: unknown; };
export type InferenceResult = { "output": Array<OutputPart>; "usage"?: unknown; "job"?: { "id": string; "status": string; "progress"?: unknown; "error"?: unknown;  };  };
export interface HostAi {
  readonly contractVersion: 1;
  contract(): Promise<{ version: number; schema_sha256: string; schema: unknown }>;
  invoke(input: InferenceRequest): Promise<Record<string, unknown> & { request_id: string; status: string }>;
  validate(input: InferenceRequest, checkSetup?: boolean): Promise<{ valid: true; setup?: { status: string; error?: unknown } }>;
  lookup(requestId: string): Promise<Record<string, unknown>>;
  status(requestId: string): Promise<Record<string, unknown> & { status?: string; result?: InferenceResult | { error: { code: string; message: string } } | null }>;
  events(requestId: string, after?: number): Promise<{ cursor: number; events: Array<{ seq: number; event: unknown }> }>;
  stop(requestId: string): Promise<{ stopping: boolean }>;
  jobStatus(requestId: string): Promise<InferenceResult>;
  jobCancel(requestId: string): Promise<InferenceResult>;
  slots(): Promise<unknown>;
  usage(): Promise<unknown>;
}
export declare function createHostAi(transport: (payload: AiEnvelope) => Promise<unknown>): HostAi;
export declare const CONTRACT: { version: 1; schema_sha256: string };
declare global { interface Window { ponpoko: { ai: HostAi; [key: string]: unknown }; } }
