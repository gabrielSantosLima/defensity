import type { ModelInfo, ProviderId } from "../../shared/types";

const TIMEOUT_MS = 15000;

export interface ProviderService {
  listModels(
    provider: ProviderId,
    apiKey: string,
    compatibleBaseUrl: string,
  ): Promise<ModelInfo[]>;
}

interface AnthropicModel {
  id: string;
  display_name?: string;
}

interface OpenAiModel {
  id: string;
}

interface GeminiModel {
  name: string;
  displayName?: string;
}

async function request(
  url: string,
  headers: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `The provider refused the request (HTTP ${response.status})`,
    );
  }
  return response.json();
}

function toModel(provider: ProviderId, id: string, name?: string): ModelInfo {
  return { provider, id, name: name?.trim() || id };
}

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export function createProviderService(): ProviderService {
  return {
    async listModels(provider, apiKey, compatibleBaseUrl) {
      if (provider === "anthropic") {
        const body = (await request(
          "https://api.anthropic.com/v1/models?limit=1000",
          {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        )) as { data?: AnthropicModel[] };
        return (body.data ?? []).map((model) =>
          toModel(provider, model.id, model.display_name),
        );
      }

      if (provider === "gemini") {
        const body = (await request(
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
          { "x-goog-api-key": apiKey },
        )) as { models?: GeminiModel[] };
        return (body.models ?? []).map((model) =>
          toModel(
            provider,
            model.name.replace(/^models\//, ""),
            model.displayName,
          ),
        );
      }

      const base =
        provider === "openai"
          ? "https://api.openai.com/v1"
          : provider === "deepinfra"
            ? "https://api.deepinfra.com/v1/openai"
            : trimBase(compatibleBaseUrl);

      const body = (await request(`${base}/models`, {
        Authorization: `Bearer ${apiKey}`,
      })) as { data?: OpenAiModel[] };

      return (body.data ?? []).map((model) => toModel(provider, model.id));
    },
  };
}
