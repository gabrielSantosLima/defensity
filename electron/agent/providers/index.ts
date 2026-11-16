import type { ChatProvider, ProviderConfig } from "../types";
import { createAnthropicProvider } from "./anthropic";
import { createGeminiProvider } from "./gemini";
import { createOpenAiProvider } from "./openai";

export function createProvider(config: ProviderConfig): ChatProvider {
  if (config.provider === "anthropic") {
    return createAnthropicProvider(config);
  }
  if (config.provider === "gemini") {
    return createGeminiProvider(config);
  }
  return createOpenAiProvider(config);
}
