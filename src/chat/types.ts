export interface ToolActivity {
  tool: string;
  ok: boolean;
  summary: string;
}

export interface InFlight {
  threadId: string;
  text: string;
  error: string | null;
  activities: ToolActivity[];
}
