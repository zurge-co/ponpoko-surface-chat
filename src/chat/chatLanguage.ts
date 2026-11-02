import { listPreferences, type Host } from "../app/host";
import {
  CHAT_LANGUAGE_AUTO,
  normalizeChatLanguage,
  PREF_CHAT_LANGUAGE,
} from "../lib/prompts/language";

export async function loadChatLanguage(host: Host): Promise<string> {
  try {
    const rows = await listPreferences(host);
    return normalizeChatLanguage(rows.find((row) => row.key === PREF_CHAT_LANGUAGE)?.value);
  } catch {
    return CHAT_LANGUAGE_AUTO;
  }
}

export function lastHumanText(history: readonly { role: string; content: string }[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (turn !== undefined && turn.role === "user") return turn.content;
  }
  return null;
}
