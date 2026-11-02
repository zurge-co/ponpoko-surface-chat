import { useEffect, useRef, useState } from "react";
import type { Host } from "../app/host";
import { subscribeStream, unsubscribeStream } from "../app/host";
import { planCatchUp, readSubscribeAnswer, type CursorState } from "./streamCursor";

export interface StreamResumeInput {
  host: Host;
  threadId: string | null;
  cursor: CursorState | null;
  onReloaded: () => void;
  onError: (message: string) => void;
}

export function useStreamResume(input: StreamResumeInput): void {
  const latest = useRef(input);
  latest.current = input;
  const [attempt, setAttempt] = useState(0);
  const threadId = input.threadId;
  const cursor = input.cursor;

  useEffect(() => {
    setAttempt(0);
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    let live = true;
    const after = cursor && cursor.threadId === threadId ? cursor.seq : 0;
    const host = latest.current.host;
    subscribeStream(host, threadId, after)
      .then((answer) => {
        if (!live) return;
        const read = readSubscribeAnswer(answer);
        if (read === null || cursor === null) return;
        if (read.cursor > cursor.seq) cursor.seq = read.cursor;
      })
      .catch((error) => {
        if (!live) return;
        const plan = planCatchUp(after, error);
        if (plan === null) {
          latest.current.onError(errorText(error));
          return;
        }
        if (cursor) cursor.seq = plan.cursor;
        latest.current.onReloaded();
        if (attempt < 1) setAttempt((current) => current + 1);
      });
    return () => {
      live = false;
      void unsubscribeStream(host, threadId).catch(() => {});
    };
  }, [attempt, cursor, threadId]);
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  const said = String(error ?? "").trim();
  return said.length > 0 ? said : "the host did not answer";
}
