export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "ponpoko.theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["dark", "light", "system"];

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

function defaultStorage(): ThemeStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function storedPreference(storage: ThemeStorage | null = defaultStorage()): ThemePreference {
  try {
    const current = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(current) ? current : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function storePreference(
  preference: ThemePreference,
  storage: ThemeStorage | null = defaultStorage(),
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
  }
}

export function systemPrefersDark(): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia("(prefers-color-scheme: light)").matches !== true;
  } catch {
    return true;
  }
}

export function currentTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function currentPreference(): ThemePreference {
  if (typeof document !== "undefined") {
    const applied = document.documentElement.dataset.themePreference;
    if (isThemePreference(applied)) return applied;
  }
  return storedPreference();
}

type ThemeListener = (preference: ThemePreference, resolved: ResolvedTheme) => void;
const listeners = new Set<ThemeListener>();

export function onThemeChange(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(preference: ThemePreference, resolved: ResolvedTheme): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener(preference, resolved);
    } catch {
    }
  }
}

export function applyTheme(
  preference: ThemePreference,
  systemDark: boolean = systemPrefersDark(),
): ResolvedTheme {
  const resolved = resolveTheme(preference, systemDark);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  const resolved = applyTheme(preference);
  storePreference(preference);
  emit(preference, resolved);
  return resolved;
}

export function toggleTheme(): ResolvedTheme {
  return setThemePreference(currentTheme() === "dark" ? "light" : "dark");
}

let systemWatcher: (() => void) | null = null;

export function initTheme(): ResolvedTheme {
  const preference = storedPreference();
  const resolved = applyTheme(preference);
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    systemWatcher?.();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (currentPreference() !== "system") return;
      const next = applyTheme("system");
      emit("system", next);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      systemWatcher = () => media.removeEventListener("change", onChange);
    }
  }
  return resolved;
}
