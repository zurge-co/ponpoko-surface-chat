import { memo, useMemo, type ReactNode } from "react";
import type { PonpokoUIAction } from "../ponpoko-ui/catalog";
import { splitPonpokoUIFences } from "../ponpoko-ui/split";
import { splitContextFences } from "./context";
import { CodeBlock } from "./CodeBlock";
import { ContextCard } from "./ContextCard";
import { PonpokoUIBlock } from "./ponpoko-ui/PonpokoUIBlock";
import {
  parseInline,
  renderMarkdown,
  type Align,
  type Block,
  type InlineNode,
  type ListItem,
} from "./markdown/index";

const ALIGN_CLASS: Record<Exclude<Align, null>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export const Markdown = memo(function Markdown(props: {
  text: string;
  streaming?: boolean;
  className?: string;
  onOpenLink?: (href: string) => void;
  onPonpokoUIAction?: (action: PonpokoUIAction) => void;
}) {
  const segments = splitContextFences(props.text);
  return (
    <div className={`md-content ${props.className ?? ""}`}>
      {segments.map((segment, index) => {
        const streaming = Boolean(props.streaming) && index === segments.length - 1;
        if (segment.kind === "file") {
          return (
            <ContextCard
              key={index}
              file={segment.file}
              complete={segment.complete}
            />
          );
        }
        return (
          <PonpokoUIAware
            key={index}
            text={segment.text}
            streaming={streaming}
            onOpenLink={props.onOpenLink}
            onPonpokoUIAction={props.onPonpokoUIAction}
          />
        );
      })}
    </div>
  );
});

function PonpokoUIAware(props: {
  text: string;
  streaming?: boolean;
  onOpenLink?: (href: string) => void;
  onPonpokoUIAction?: (action: PonpokoUIAction) => void;
}) {
  const segments = splitPonpokoUIFences(props.text);
  return (
    <>
      {segments.map((segment, index) => {
        const streaming = Boolean(props.streaming) && index === segments.length - 1;
        if (segment.kind === "ponpoko-ui") {
          return (
            <PonpokoUIBlock
              key={index}
              code={segment.code}
              streaming={streaming && !segment.complete}
              onAction={props.onPonpokoUIAction}
            />
          );
        }
        return (
          <Prose
            key={index}
            text={segment.text}
            streaming={streaming}
            onOpenLink={props.onOpenLink}
          />
        );
      })}
    </>
  );
}

function ProseImpl(props: {
  text: string;
  streaming?: boolean;
  onOpenLink?: (href: string) => void;
}) {
  const blocks = useMemo(() => renderMarkdown(props.text), [props.text]);
  return (
    <>
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          streaming={props.streaming && index === blocks.length - 1}
          onOpenLink={props.onOpenLink}
        />
      ))}
    </>
  );
}

const Prose = memo(
  ProseImpl,
  (a, b) =>
    a.text === b.text && a.streaming === b.streaming && a.onOpenLink === b.onOpenLink,
);

function blockKey(block: Block): string {
  return JSON.stringify(block);
}

const BlockView = memo(
  BlockViewImpl,
  (a, b) =>
    a.streaming === b.streaming &&
    a.onOpenLink === b.onOpenLink &&
    blockKey(a.block) === blockKey(b.block),
);

function BlockViewImpl(props: {
  block: Block;
  streaming?: boolean;
  onOpenLink?: (href: string) => void;
}) {
  const { block } = props;
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <InlineView nodes={parseInline(block.text)} onOpenLink={props.onOpenLink} />
        </p>
      );
    case "heading": {
      const level = Math.min(6, Math.max(1, block.level));
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag>
          <InlineView nodes={parseInline(block.text)} onOpenLink={props.onOpenLink} />
        </Tag>
      );
    }
    case "code":
      return <CodeBlock code={block.code} lang={block.lang} streaming={props.streaming} />;
    case "hr":
      return <hr />;
    case "blockquote":
      return (
        <blockquote>
          {block.blocks.map((child, index) => (
            <BlockView key={index} block={child} onOpenLink={props.onOpenLink} />
          ))}
        </blockquote>
      );
    case "list":
      return (
        <ListView
          ordered={block.ordered}
          start={block.start}
          items={block.items}
          onOpenLink={props.onOpenLink}
        />
      );
    case "table":
      return (
        <div className="my-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-xs">
            <thead>
              <tr className="bg-active/60">
                {block.header.map((cell, index) => (
                  <th
                    key={index}
                    className={`border-b border-border px-3 py-2 font-semibold text-fg ${
                      ALIGN_CLASS[block.align[index] ?? "left"]
                    }`}
                  >
                    <InlineView nodes={parseInline(cell)} onOpenLink={props.onOpenLink} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-hover/40">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`border-b border-border/60 px-3 py-2 align-top text-fg-muted ${
                        ALIGN_CLASS[block.align[cellIndex] ?? "left"]
                      }`}
                    >
                      <InlineView nodes={parseInline(cell)} onOpenLink={props.onOpenLink} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function ListView(props: {
  ordered: boolean;
  start: number;
  items: ListItem[];
  onOpenLink?: (href: string) => void;
}) {
  const Tag = props.ordered ? "ol" : "ul";
  return (
    <Tag start={props.ordered ? props.start : undefined}>
      {props.items.map((item, index) => (
        <li key={index} className={item.checked !== null ? "list-none" : undefined}>
          {item.checked !== null ? (
            <span className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                tabIndex={-1}
                aria-label={item.checked ? "done" : "not done"}
                className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
              />
              <span>
                <InlineView nodes={parseInline(item.text)} onOpenLink={props.onOpenLink} />
              </span>
            </span>
          ) : (
            <InlineView nodes={parseInline(item.text)} onOpenLink={props.onOpenLink} />
          )}
          {item.children.map((child, childIndex) => (
            <BlockView key={childIndex} block={child} onOpenLink={props.onOpenLink} />
          ))}
        </li>
      ))}
    </Tag>
  );
}

function InlineView(props: { nodes: InlineNode[]; onOpenLink?: (href: string) => void }) {
  return <>{props.nodes.map((node, index) => inlineNode(node, index, props.onOpenLink))}</>;
}

function inlineNode(
  node: InlineNode,
  key: number,
  onOpenLink?: (href: string) => void,
): ReactNode {
  switch (node.type) {
    case "text":
      return <span key={key}>{node.text}</span>;
    case "code":
      return <code key={key}>{node.text}</code>;
    case "strong":
      return (
        <strong key={key}>
          <InlineView nodes={node.children} onOpenLink={onOpenLink} />
        </strong>
      );
    case "em":
      return (
        <em key={key}>
          <InlineView nodes={node.children} onOpenLink={onOpenLink} />
        </em>
      );
    case "del":
      return (
        <del key={key}>
          <InlineView nodes={node.children} onOpenLink={onOpenLink} />
        </del>
      );
    case "link": {
      const label = <InlineView nodes={node.children} onOpenLink={onOpenLink} />;
      if (node.image) return <span key={key}>Image: {label}</span>;
      return (
        <a
          key={key}
          href={node.href}
          title={node.href}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => {
            if (!onOpenLink) return;
            event.preventDefault();
            onOpenLink(node.href);
          }}
        >
          {label}
        </a>
      );
    }
  }
}
