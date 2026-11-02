import type { InlineNode, Block } from "./types";
import { renderMarkdown } from "./render";
import { parseInline } from "./inline";

export const parseMarkdown = renderMarkdown;

export function blockText(blocks: Block[]): string {
  const inlineText = (nodes: InlineNode[]): string =>
    nodes
      .map((node) => {
        switch (node.type) {
          case "text":
          case "code":
            return node.text;
          case "strong":
          case "em":
          case "del":
          case "link":
            return inlineText(node.children);
        }
      })
      .join("");

  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return inlineText(parseInline(block.text));
        case "heading":
          return block.text;
        case "code":
          return block.code;
        case "list":
          return block.items
            .map((item) => `${inlineText(parseInline(item.text))}${blockText(item.children)}`)
            .join("");
        case "blockquote":
          return blockText(block.blocks);
        case "table":
          return [...block.header, ...block.rows.flat()].join("");
        case "hr":
          return "";
      }
    })
    .join("");
}
