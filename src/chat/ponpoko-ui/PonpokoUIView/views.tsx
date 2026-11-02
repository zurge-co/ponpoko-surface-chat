import { Fragment, useId, useState, type KeyboardEvent } from "react";
import { type PonpokoUIElement } from "../../../ponpoko-ui/catalog";
import type { ViewProps } from "./values";
import { renderElement } from "./render";
import { chartPath, patchLineClass } from "./chart";

export function BarsView(props: { data: { label: string; value: number }[]; title: string }) {
  const width = 320;
  const height = 96;
  const pad = 6;
  const max = Math.max(1, ...props.data.map((entry) => entry.value));
  const slot = props.data.length > 0 ? (width - pad * 2) / props.data.length : 0;
  const barWidth = Math.max(2, slot * 0.62);
  const summary = props.data.map((entry) => `${entry.label} ${entry.value}`).join(", ");
  return (
    <figure className="rounded-lg border border-border bg-panel/30 px-3.5 py-2.5">
      {props.title && (
        <figcaption className="mb-1 text-xs font-semibold text-fg">{props.title}</figcaption>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Bar chart${props.title ? `: ${props.title}` : ""}. ${summary}`}
        className="h-auto w-full max-w-[26rem]"
      >
        {props.data.map((entry, index) => {
          const barHeight = (entry.value / max) * (height - pad * 2);
          return (
            <rect
              key={index}
              x={pad + index * slot + (slot - barWidth) / 2}
              y={height - pad - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              fill="var(--color-accent)"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex gap-1 overflow-hidden text-xs text-fg-muted">
        {props.data.map((entry, index) => (
          <span key={index} className="min-w-0 flex-1 truncate text-center">
            {entry.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function LineView(props: { points: number[]; labels: string[]; title: string; label: string }) {
  const width = 320;
  const height = 96;
  const pad = 6;
  const min = props.points.length > 0 ? Math.min(...props.points) : 0;
  const max = props.points.length > 0 ? Math.max(...props.points) : 0;
  return (
    <figure className="rounded-lg border border-border bg-panel/30 px-3.5 py-2.5">
      {props.title && (
        <figcaption className="mb-1 text-xs font-semibold text-fg">{props.title}</figcaption>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Line chart: ${props.label}. ${props.points.length} points from ${min} to ${max}.`}
        className="h-auto w-full max-w-[26rem]"
      >
        <path
          d={chartPath(props.points, width, height, pad)}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {props.labels.length > 0 && (
        <div className="mt-1 flex justify-between gap-2 text-xs text-fg-muted">
          <span className="truncate">{props.labels[0]}</span>
          {props.labels.length > 2 && (
            <span className="truncate">{props.labels[Math.floor(props.labels.length / 2)]}</span>
          )}
          <span className="truncate">{props.labels[props.labels.length - 1]}</span>
        </div>
      )}
    </figure>
  );
}

export function SparklineView(props: { points: number[]; label: string }) {
  const width = 120;
  const height = 28;
  const min = props.points.length > 0 ? Math.min(...props.points) : 0;
  const max = props.points.length > 0 ? Math.max(...props.points) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Sparkline: ${props.label}. ${props.points.length} points from ${min} to ${max}.`}
        className="h-7 w-[7.5rem]"
      >
        <path
          d={chartPath(props.points, width, height, 3)}
          fill="none"
          stroke="var(--color-accent-lime)"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="text-xs text-fg-muted">{props.label}</span>
    </span>
  );
}


export function TabsView(props: { labels: string[]; panels: PonpokoUIElement[][]; props: ViewProps }) {
  const base = useId();
  const [active, setActive] = useState(0);
  const labels = props.labels;
  if (labels.length === 0) return null;
  const current = Math.min(active, labels.length - 1);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % labels.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + labels.length) % labels.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = labels.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    const buttons =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next]?.focus();
  };

  return (
    <div className="rounded-lg border border-border bg-panel/30">
      <div
        role="tablist"
        aria-label="Generated UI tabs"
        onKeyDown={move}
        className="flex flex-wrap gap-1 border-b border-border/70 px-2 py-1.5"
      >
        {labels.map((label, index) => (
          <button
            key={index}
            id={`${base}-tab-${index}`}
            role="tab"
            type="button"
            aria-selected={index === current}
            aria-controls={`${base}-panel`}
            tabIndex={index === current ? 0 : -1}
            onClick={() => setActive(index)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              index === current
                ? "bg-active font-semibold text-fg"
                : "text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${current}`}
        className="flex flex-col gap-3 px-3.5 py-3"
      >
        {props.panels[current]?.map((panelElement, index) => (
          <Fragment key={index}>{renderElement(panelElement, props.props)}</Fragment>
        ))}
      </div>
    </div>
  );
}

export function AccordionView(props: { titles: string[]; panels: PonpokoUIElement[][]; props: ViewProps }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel/30">
      {props.titles.map((title, index) => (
        <details key={index} className="group border-b border-border/60 last:border-b-0">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2 text-xs font-medium text-fg hover:bg-hover">
            {title}
            <span aria-hidden className="text-fg-muted transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <div className="flex flex-col gap-3 px-3.5 pb-3 pt-1">
            {props.panels[index]?.map((panelElement, panelIndex) => (
              <Fragment key={panelIndex}>{renderElement(panelElement, props.props)}</Fragment>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}


export function PatchView(props: { title: string; diff: string }) {
  const lines = props.diff.split("\n");
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-code">
      <figcaption className="flex h-8 items-center border-b border-border bg-panel/60 px-3 font-mono text-xs uppercase tracking-wider text-fg-muted">
        {props.title || "patch"}
      </figcaption>
      <pre
        aria-label={`Proposed patch: ${props.title || "changes"}`}
        className="max-h-[28rem] overflow-auto px-3.5 py-2.5 font-mono text-xs leading-[1.6]"
      >
        <code>
          {lines.map((line, index) => (
            <span key={index} className={`block ${patchLineClass(line)}`}>
              {line || " "}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
