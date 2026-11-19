import type {
  AgentMessage,
  AgentToolCall,
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderConfig,
  Usage,
} from "../types";
import { providerFetch, sseData } from "./sse";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function toContents(messages: AgentMessage[]): {
  system: string;
  contents: GeminiContent[];
} {
  const system: string[] = [];
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      system.push(message.content);
      continue;
    }
    if (message.role === "user") {
      const last = contents[contents.length - 1];
      if (last?.role === "user" && last.parts.every((part) => part.text)) {
        last.parts.push({ text: message.content });
      } else {
        contents.push({ role: "user", parts: [{ text: message.content }] });
      }
      continue;
    }
    if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    const part: GeminiPart = {
      functionResponse: {
        name: message.toolCallId ?? "tool",
        response: { content: message.content },
      },
    };
    const last = contents[contents.length - 1];
    if (last?.role === "user" && last.parts.every((entry) => entry.functionResponse)) {
      last.parts.push(part);
    } else {
      contents.push({ role: "user", parts: [part] });
    }
  }

  return { system: system.join("\n\n"), contents };
}

export function createGeminiProvider(config: ProviderConfig): ChatProvider {
  return {
    async chat(request: ChatRequest): Promise<ChatResult> {
      const converted = toContents(request.messages);
      const body: Record<string, unknown> = {
        contents: converted.contents,
        tools: [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ],
      };
      if (converted.system) {
        body.systemInstruction = { parts: [{ text: converted.system }] };
      }

      const response = await providerFetch(
        `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        "Gemini",
        request.signal,
      );

      let text = "";
      let usage: Usage | null = null;
      const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

      for await (const data of sseData(response)) {
        const chunk = JSON.parse(data) as {
          candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };

        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) {
            text += part.text;
            request.onDelta?.(part.text);
          }
          if (part.functionCall) {
            calls.push({
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
            });
          }
        }

        if (chunk.usageMetadata) {
          usage = {
            promptTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            completionTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
          };
        }
      }

      const toolCalls: AgentToolCall[] = calls.map((call, index) => ({
        id: `call_${index}`,
        name: call.name,
        arguments: call.args,
      }));

      return { text, toolCalls, usage };
    },
  };
}
