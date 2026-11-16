import type { ProviderId } from "../../shared/types";

/**
 * Resolves the HTTP base URL for a provider. The compatible provider has no
 * default: it requires the base URL configured in settings.
 */
export function baseUrlFor(
  provider: ProviderId,
  compatibleBaseUrl: string,
): string {
  if (provider === "openai") {
    return "https://api.openai.com/v1";
  }
  if (provider === "deepinfra") {
    return "https://api.deepinfra.com/v1/openai";
  }
  if (provider === "anthropic") {
    return "https://api.anthropic.com";
  }
  if (provider === "gemini") {
    return "https://generativelanguage.googleapis.com";
  }
  return compatibleBaseUrl.replace(/\/+$/, "");
}
