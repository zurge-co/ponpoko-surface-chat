import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { pasteImage as hostPasteImage, pickAttachments, readAttachments, type Host } from "../app/host";
import type { ContextFileView } from "../contracts/types";
import { planContextAttach, type ContextFile } from "./context";
import { PASTE_ADDED_SENTENCE, pasteRefusal, pasteRoute } from "./paste";

function asContextFile(view: ContextFileView): ContextFile {
  const file: ContextFile = {
    name: view.name,
    path: view.path,
    bytes: view.bytes,
    kind: view.kind,
    content: view.content,
  };
  if (view.media_type) file.mediaType = view.media_type;
  return file;
}

export function useChatContext(host: Host, setError: (message: string | null) => void) {
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const contextFilesRef = useRef<ContextFile[]>([]);
  useEffect(() => {
    contextFilesRef.current = contextFiles;
  }, [contextFiles]);

  const addContextPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      const read: ContextFile[] = [];
      const refusals: string[] = [];
      let views: ContextFileView[] = [];
      try {
        views = await readAttachments(host, paths);
      } catch (e) {
        refusals.push(String(e));
      }
      for (const view of views) read.push(asContextFile(view));
      const plan = planContextAttach(contextFilesRef.current, read);
      setContextFiles(plan.files);
      setError([...refusals, ...plan.refused].join(" ") || null);
    },
    [host, setError],
  );

  const pickContextFiles = useCallback(async () => {
    try {
      const views = await pickAttachments(host);
      if (views.length === 0) return;
      const plan = planContextAttach(contextFilesRef.current, views.map(asContextFile));
      setContextFiles(plan.files);
      setError(plan.refused.length > 0 ? plan.refused.join(" ") : null);
    } catch (e) {
      setError(String(e));
    }
  }, [host, setError]);

  useEffect(() => {
    return host.broker.onDrop((paths) => {
      setDragging(false);
      if (paths.length > 0) void addContextPaths([...paths]);
    });
  }, [addContextPaths, host]);

  const removeContextFile = (path: string) =>
    setContextFiles((prev) => prev.filter((file) => file.path !== path));

  const pasteImage = useCallback(async () => {
    try {
      const pasted = asContextFile(await hostPasteImage(host));
      const plan = planContextAttach(contextFilesRef.current, [pasted]);
      setContextFiles(plan.files);
      setError(plan.refused.length > 0 ? plan.refused.join(" ") : null);
      return plan.added.length > 0 ? PASTE_ADDED_SENTENCE : null;
    } catch (e) {
      setError(pasteRefusal(e));
      return null;
    }
  }, [host, setError]);

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>): boolean => {
      const data = event.clipboardData;
      if (!data) return false;
      const types = Array.from(data.types ?? []);
      const route = pasteRoute(types, data.getData("text/plain").length > 0);
      if (route !== "image") return false;
      event.preventDefault();
      void pasteImage();
      return true;
    },
    [pasteImage],
  );

  return {
    contextFiles,
    setContextFiles,
    dragging,
    addContextPaths,
    pickContextFiles,
    removeContextFile,
    pasteImage,
    onPaste,
  };
}
