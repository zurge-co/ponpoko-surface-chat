import type { ChatProviderView } from "../contracts/types";

export function providerOptionLabel(provider: ChatProviderView | null | undefined): string {
  if (!provider) return "";
  const name = provider.label?.trim() || provider.provider_id;
  const model = provider.model.trim();
  return model.length > 0 ? `${name} · ${model}` : name;
}

export type ChatReadiness = boolean | null;

export function chatReadiness(
  providers: readonly ChatProviderView[] | null,
  providerId: string | null,
): ChatReadiness {
  if (providers === null) return null;
  const provider = providers.find((entry) => entry.provider_id === providerId) ?? providers[0] ?? null;
  return Boolean(provider && provider.has_key && provider.model.trim().length > 0);
}

export function providerReady(provider: ChatProviderView | null | undefined): boolean {
  return Boolean(provider && provider.has_key && provider.model.trim().length > 0);
}
