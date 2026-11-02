import { useEffect, useState } from "react";
import { searchThreads, type Host } from "../app/host";
import type { ChatThreadSearchHit } from "../contracts/types";

export function useThreadSearch(
  host: Host,
  query: string,
  onError: (message: string) => void,
): ChatThreadSearchHit[] | null {
  const [state, setState] = useState<{ query: string; hits: ChatThreadSearchHit[] | null }>({
    query: "",
    hits: null,
  });
  const hits = state.query === query ? state.hits : null;
  useEffect(() => {
    if (!query.trim()) return;
    let live = true;
    const timer = setTimeout(() => {
      searchThreads(host, query)
        .then((rows) => {
          if (live) setState({ query, hits: rows });
        })
        .catch((e) => {
          if (live) onError(String(e));
        });
    }, 120);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [host, query, onError]);
  return hits;
}
