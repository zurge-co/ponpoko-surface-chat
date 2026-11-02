import { isPonpokoUIAction, isPonpokoUIElement, isPonpokoUIObject, type PonpokoUIAction, type PonpokoUIElement, type PonpokoUIObject, type PonpokoUIValue } from "../../../ponpoko-ui/catalog";

export interface ViewProps {
  onAction?: (action: PonpokoUIAction) => void;
}


export function text(value: PonpokoUIValue | undefined, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function count(value: PonpokoUIValue | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function flag(value: PonpokoUIValue | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function list(value: PonpokoUIValue | undefined): PonpokoUIValue[] {
  return Array.isArray(value) ? value : [];
}

export function elements(value: PonpokoUIValue | undefined): PonpokoUIElement[] {
  return list(value).filter(isPonpokoUIElement);
}

export function strings(value: PonpokoUIValue | undefined): string[] {
  return list(value).filter((item): item is string => typeof item === "string");
}

export function numbers(value: PonpokoUIValue | undefined): number[] {
  return list(value).filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
}

export function rows(value: PonpokoUIValue | undefined): (string | number)[][] {
  return list(value)
    .filter(Array.isArray)
    .map((row) =>
      row.filter(
        (cell): cell is string | number =>
          typeof cell === "string" || (typeof cell === "number" && Number.isFinite(cell)),
      ),
    );
}

export function records(value: PonpokoUIValue | undefined): PonpokoUIObject[] {
  return list(value).filter(isPonpokoUIObject);
}

export function action(value: PonpokoUIValue | undefined): PonpokoUIAction | null {
  return isPonpokoUIAction(value) ? value : null;
}


export const BADGE_TONE: Record<string, string> = {
  neutral: "border-border-strong bg-active text-fg-muted",
  accent: "border-accent/40 bg-accent/10 text-accent",
  warn: "border-yellow/40 bg-yellow/10 text-yellow",
  danger: "border-danger/40 bg-danger/10 text-danger",
  success: "border-accent/40 bg-accent/10 text-accent-lime",
};

export const CALLOUT_TONE: Record<string, { box: string; title: string }> = {
  info: { box: "border-border-strong bg-panel/60", title: "text-fg" },
  warn: { box: "border-yellow/35 bg-yellow/5", title: "text-yellow" },
  danger: { box: "border-danger/35 bg-danger/5", title: "text-danger" },
  success: { box: "border-accent/35 bg-accent/5", title: "text-accent" },
};

export const METRIC_TONE: Record<string, string> = {
  default: "text-fg",
  accent: "text-accent",
  warn: "text-yellow",
  danger: "text-danger",
};

export const HEADING_CLASS: Record<number, string> = {
  1: "text-[16px] font-semibold text-fg",
  2: "text-[15px] font-semibold text-fg",
  3: "text-[13.5px] font-semibold text-fg",
  4: "text-[12.5px] font-semibold text-fg",
  5: "text-[12px] font-medium text-fg-subtle",
  6: "text-[11px] font-medium uppercase tracking-wider text-fg-muted",
};

export const STEP_STATUS: Record<string, { dot: string; label: string }> = {
  todo: { dot: "border-border-strong bg-transparent", label: "To do" },
  doing: { dot: "border-accent bg-accent/40", label: "In progress" },
  done: { dot: "border-accent bg-accent", label: "Done" },
  blocked: { dot: "border-danger bg-danger/50", label: "Blocked" },
};

export function gapStyle(gap: number | undefined): { gap: string } {
  const step = Math.min(8, Math.max(0, gap ?? 3));
  return { gap: `${step * 4}px` };
}
