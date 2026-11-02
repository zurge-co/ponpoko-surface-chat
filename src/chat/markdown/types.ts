export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "del"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[]; image?: boolean };

export type Align = "left" | "center" | "right" | null;

export interface ListItem {
  text: string;
  checked: boolean | null;
  children: Block[];
}

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string; closed: boolean }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "blockquote"; blocks: Block[] }
  | { type: "table"; header: string[]; align: Align[]; rows: string[][] }
  | { type: "hr" };

export const FENCE = /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)?\s*$/;
export const HEADING = /^( {0,3})(#{1,6})\s+(.*)$/;
export const HR = /^( {0,3})([-*_])(?:\s*\2){2,}\s*$/;
export const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
export const TABLE_DELIM = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;
