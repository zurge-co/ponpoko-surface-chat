import { readFileSync } from "node:fs";
import type { Row } from "./store";

export function contextMessages(rows: Row[]): Row[] {
  return rows.map(row => {
    const meta = row.meta_json ? JSON.parse(row.meta_json) : {};
    const message: Row = { role: row.role, content: row.content, tool_calls: meta.tool_calls ?? [], tool_call_id: meta.tool_call_id ?? null, images: meta.images ?? [] };
    if (row.role !== "user" || message.images.length > 0) return message;
    const paths = new Set<string>();
    for (const line of String(row.content).split("\n")) {
      const fence = /^\s*(`{3,}|~{3,})ponpoko-image\s+(.+)$/.exec(line);
      if (!fence) continue;
      const attr = /(?:^|\s)path=("(?:[^"\\]|\\.)*"|[^\s]+)/.exec(fence[2]!);
      if (!attr) continue;
      const value = attr[1]!;
      paths.add(value.startsWith('"') ? JSON.parse(value) : decodeURIComponent(value));
    }
    for (const path of paths) {
      const bytes = readFileSync(path);
      if (bytes.length > 5 * 1024 * 1024) throw new Error("An attached image exceeds 5 MiB");
      const media = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
        : bytes[0] === 255 && bytes[1] === 216 ? "image/jpeg"
        : bytes.subarray(0, 3).toString() === "GIF" ? "image/gif"
        : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
      if (!media) throw new Error("The attached file is not a supported image");
      message.images.push({ media_type: media, data_base64: bytes.toString("base64") });
    }
    return message;
  });
}
