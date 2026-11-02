import { type PonpokoUICaps, type PonpokoUIElement, type PonpokoUIValue } from "../catalog";
import type { PonpokoUIError } from "../lexer";
import { type PonpokoUIStatement } from "../parser";

export const MAX_ERRORS = 25;

export interface PonpokoUIEvalOptions {
  caps?: Partial<PonpokoUICaps>;
}

export interface EvaluatedPonpokoUI {
  tree: PonpokoUIElement | null;
  errors: PonpokoUIError[];
  incomplete: boolean;
  nodes: number;
}

export interface Ctx {
  defs: Map<string, PonpokoUIStatement>;
  memo: Map<string, PonpokoUIValue | undefined>;
  resolving: Set<string>;
  errors: PonpokoUIError[];
  caps: PonpokoUICaps;
  nodes: number;
  nodeLimitHit: boolean;
  depthLimitHit: boolean;
}
