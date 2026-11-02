import { Fragment, type ReactNode } from "react";
import { type PonpokoUIElement, type PonpokoUIValue } from "../../../ponpoko-ui/catalog";
import { CodeBlock } from "../../CodeBlock";
import { text, count, flag, list, elements, strings, numbers, rows, records, action, BADGE_TONE, CALLOUT_TONE, METRIC_TONE, HEADING_CLASS, STEP_STATUS, gapStyle } from "./values";
import type { ViewProps } from "./values";
import { BarsView, LineView, SparklineView, TabsView, AccordionView, PatchView } from "./views";

export function renderElements(value: PonpokoUIValue | undefined, props: ViewProps): ReactNode {
  return elements(value).map((child, index) => (
    <Fragment key={index}>{renderElement(child, props)}</Fragment>
  ));
}

export function renderElement(element: PonpokoUIElement, props: ViewProps): ReactNode {
  const p = element.props;
  switch (element.name) {
    case "Card":
      return (
        <section className="overflow-hidden rounded-xl border border-border bg-panel/50">
          <header className="border-b border-border/70 bg-elevated/30 px-3.5 py-2">
            <h3 className="text-xs font-semibold text-fg">{text(p.title)}</h3>
          </header>
          <div className="flex flex-col gap-3 px-3.5 py-3">{renderElements(p.children, props)}</div>
          {text(p.footnote) && (
            <p className="border-t border-border/60 px-3.5 py-2 text-xs text-fg-muted">
              {text(p.footnote)}
            </p>
          )}
        </section>
      );

    case "Row":
      return (
        <div
          className={`flex flex-wrap ${
            p.align === "center"
              ? "items-center"
              : p.align === "end"
                ? "items-end"
                : p.align === "start"
                  ? "items-start"
                  : "items-stretch"
          }`}
          style={gapStyle(count(p.gap, 3))}
        >
          {renderElements(p.children, props)}
        </div>
      );

    case "Stack":
      return (
        <div className="flex flex-col" style={gapStyle(count(p.gap, 3))}>
          {renderElements(p.children, props)}
        </div>
      );

    case "Grid": {
      const columns = Math.min(6, Math.max(1, Math.round(count(p.columns, 2))));
      return (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {renderElements(p.children, props)}
        </div>
      );
    }

    case "Heading": {
      const level = Math.min(6, Math.max(1, Math.round(count(p.level, 3))));
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return <Tag className={HEADING_CLASS[level]}>{text(p.text)}</Tag>;
    }

    case "Text": {
      const tone =
        p.tone === "muted" ? "text-fg-muted" : p.tone === "strong" ? "font-medium text-fg" : "text-fg";
      return <p className={`whitespace-pre-wrap ${tone}`}>{text(p.text)}</p>;
    }

    case "Badge": {
      const tone = BADGE_TONE[text(p.tone, "neutral")] ?? BADGE_TONE.neutral!;
      return (
        <span
          className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
        >
          {text(p.label)}
        </span>
      );
    }

    case "Callout": {
      const tone = CALLOUT_TONE[text(p.tone, "info")] ?? CALLOUT_TONE.info!;
      return (
        <div className={`rounded-xl border px-3.5 py-3 ${tone.box}`}>
          <p className={`mb-1.5 text-xs font-semibold ${tone.title}`}>{text(p.title)}</p>
          <div className="flex flex-col gap-2 text-fg">{renderElements(p.children, props)}</div>
        </div>
      );
    }

    case "Metric": {
      const tone = METRIC_TONE[text(p.tone, "default")] ?? METRIC_TONE.default!;
      return (
        <div className="min-w-[8rem] flex-1 rounded-xl border border-border bg-elevated/25 px-3.5 py-2.5">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-fg-muted">
            {text(p.label)}
          </p>
          <p className={`mt-0.5 text-[19px] font-semibold leading-tight ${tone}`}>{text(p.value)}</p>
          {text(p.hint) && <p className="mt-0.5 text-xs text-fg-muted">{text(p.hint)}</p>}
        </div>
      );
    }

    case "Facts": {
      const pairs = list(p.pairs)
        .filter((pair): pair is PonpokoUIValue[] => Array.isArray(pair) && pair.length >= 2)
        .map((pair) => [text(pair[0]), text(pair[1])] as const);
      return (
        <div className="rounded-lg border border-border bg-panel/40 px-3.5 py-2.5">
          {text(p.title) && (
            <p className="mb-1.5 text-xs font-semibold text-fg">{text(p.title)}</p>
          )}
          <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1.5 text-xs">
            {pairs.map(([label, value], index) => (
              <Fragment key={index}>
                <dt className="text-fg-muted">{label}</dt>
                <dd className="break-words text-fg">{value}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      );
    }

    case "Table": {
      const columns = strings(p.columns);
      const body = rows(p.rows);
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-[26rem] overflow-auto">
            <table className="w-full min-w-[24rem] border-collapse text-xs">
              {text(p.caption) && (
                <caption className="caption-bottom border-t border-border/60 bg-panel/40 px-3 py-1.5 text-left text-xs text-fg-muted">
                  {text(p.caption)}
                </caption>
              )}
              <thead className="sticky top-0 bg-elevated">
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      scope="col"
                      className="border-b border-border px-3 py-2 text-left font-semibold text-fg"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex} className="odd:bg-hover/30">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border-b border-border/60 px-3 py-1.5 align-top text-fg-muted"
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case "List": {
      const Tag = flag(p.ordered, false) ? "ol" : "ul";
      return (
        <div className="rounded-lg border border-border bg-panel/30 px-3.5 py-2.5">
          {text(p.title) && (
            <p className="mb-1 text-xs font-semibold text-fg">{text(p.title)}</p>
          )}
          <Tag
            className={`space-y-1 pl-4 text-xs text-fg-muted ${
              flag(p.ordered, false) ? "list-decimal" : "list-disc"
            }`}
          >
            {strings(p.items).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </Tag>
        </div>
      );
    }

    case "Code": {
      const title = text(p.title);
      return (
        <div>
          {title && <p className="mb-1 font-mono text-xs text-fg-muted">{title}</p>}
          <CodeBlock code={text(p.code)} lang={text(p.language, "text")} />
        </div>
      );
    }

    case "Patch":
      return <PatchView title={text(p.title)} diff={text(p.diff)} />;

    case "Steps": {
      const steps = records(p.steps);
      return (
        <div className="rounded-lg border border-border bg-panel/30 px-3.5 py-2.5">
          {text(p.title) && (
            <p className="mb-1.5 text-xs font-semibold text-fg">{text(p.title)}</p>
          )}
          <ol className="space-y-2">
            {steps.map((step, index) => {
              const status = STEP_STATUS[text(step.status, "todo")] ?? STEP_STATUS.todo!;
              return (
                <li key={index} className="flex items-start gap-2.5">
                  <span
                    className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-fg ${status.dot}`}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-fg">{text(step.title)}</span>
                    {text(step.detail) && (
                      <span className="block text-xs text-fg-muted">{text(step.detail)}</span>
                    )}
                    <span className="sr-only">{status.label}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-xs uppercase tracking-wide text-fg-muted">
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      );
    }

    case "Progress": {
      const max = Math.max(1, count(p.max, 100));
      const value = Math.min(max, Math.max(0, count(p.value, 0)));
      const percent = Math.round((value / max) * 100);
      return (
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="text-fg">{text(p.label)}</span>
            <span className="font-mono text-fg-muted">
              {value}/{max}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={text(p.label)}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={value}
            className="h-1.5 overflow-hidden rounded-full bg-active"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
        </div>
      );
    }

    case "Bars": {
      const data = records(p.data).map((record) => ({
        label: text(record.label),
        value: Math.max(0, count(record.value, 0)),
      }));
      return <BarsView data={data} title={text(p.title)} />;
    }

    case "Line": {
      const title = text(p.title);
      return (
        <LineView
          points={numbers(p.points)}
          labels={strings(p.labels)}
          title={title}
          label={title || "line chart"}
        />
      );
    }

    case "Sparkline": {
      const label = text(p.label, "sparkline");
      return <SparklineView points={numbers(p.points)} label={label} />;
    }

    case "Tabs":
      return (
        <TabsView
          labels={strings(p.labels)}
          panels={list(p.panels).map((panel) => elements(panel))}
          props={props}
        />
      );

    case "Accordion":
      return (
        <AccordionView
          titles={strings(p.titles)}
          panels={list(p.panels).map((panel) => elements(panel))}
          props={props}
        />
      );

    case "Buttons":
      return <div className="flex flex-wrap items-center gap-2">{renderElements(p.children, props)}</div>;

    case "Button": {
      const act = action(p.action);
      const variant = text(p.variant, "ghost");
      const style =
        variant === "primary"
          ? "border border-accent/50 bg-accent text-on-accent hover:brightness-110"
          : variant === "danger"
            ? "border border-danger/50 text-danger hover:bg-danger/10"
            : "border border-border-strong text-fg hover:bg-active";
      return (
        <button
          type="button"
          disabled={!act || !props.onAction}
          onClick={() => {
            if (act) props.onAction?.(act);
          }}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-45 ${style}`}
        >
          {text(p.label)}
        </button>
      );
    }

    case "Divider": {
      const spacing = Math.min(8, Math.max(0, count(p.spacing, 3))) * 4;
      return <hr className="border-border" style={{ marginTop: spacing, marginBottom: spacing }} />;
    }

    default:
      return null;
  }
}
