export const PREF_PROVIDER_ID = "chat_provider_id";

export const PREF_RAIL_COLLAPSED = "chat_rail_collapsed";

const STORAGE_PREFIX = "ponpoko.surface.chat.";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function storedValue(key: string): string | null {
  const box = storage();
  if (!box) return null;
  try {
    return box.getItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function storeValue(key: string, value: string): void {
  const box = storage();
  if (!box) return;
  try {
    box.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch {
    return;
  }
}

export async function loadChatProviderId(): Promise<string | null> {
  const value = storedValue(PREF_PROVIDER_ID)?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function saveChatProviderId(providerId: string): void {
  storeValue(PREF_PROVIDER_ID, providerId);
}

export async function loadChatRailCollapsed(): Promise<boolean> {
  return storedValue(PREF_RAIL_COLLAPSED) === "1";
}

export function saveChatRailCollapsed(collapsed: boolean): void {
  storeValue(PREF_RAIL_COLLAPSED, collapsed ? "1" : "0");
}

export async function loadChatLanguageSetting(): Promise<string | null> {
  return storedValue("chat_language");
}

export function saveChatLanguageSetting(language: string): void {
  storeValue("chat_language", language);
}
