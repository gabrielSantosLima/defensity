import type {
  AgentMessage,
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderConfig,
  AgentToolCall,
  Usage,
} from "../types";
import { providerFetch, sseData } from "./sse";

interface OpenAiDeltaCall {
  index: number;
  id?: string;
  name?: string;
  args: string;
}

function toMessage(message: AgentMessage): Record<string, unknown> {
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    };
  }
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }
  return { role: message.role, content: message.content };
}

export function createOpenAiProvider(config: ProviderConfig): ChatProvider {
  return {
    async chat(request: ChatRequest): Promise<ChatResult> {
      const body = {
        model: config.model,
        messages: request.messages.map(toMessage),
        tools: request.tools.map((tool) => ({
          type: "function",
          function: tool,
        })),
        stream: true,
        stream_options: { include_usage: true },
      };
      if (request.tools.length === 0) {
        delete (body as { tools?: unknown }).tools;
      }

      const response = await providerFetch(
        `${config.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        "OpenAI",
        request.signal,
      );

      let text = "";
      const calls = new Map<number, OpenAiDeltaCall>();
      let usage: Usage | null = null;

      for await (const data of sseData(response)) {
        if (data === "[DONE]") {
          break;
        }
        const chunk = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          text += delta.content;
          request.onDelta?.(delta.content);
        }
        for (const call of delta?.tool_calls ?? []) {
          const slot = calls.get(call.index) ?? { index: call.index, args: "" };
          if (call.id) {
            slot.id = call.id;
          }
          if (call.function?.name) {
            slot.name = (slot.name ?? "") + call.function.name;
          }
          if (call.function?.arguments) {
            slot.args += call.function.arguments;
          }
          calls.set(call.index, slot);
        }
        if (chunk.usage) {
          const promptTokens = chunk.usage.prompt_tokens ?? 0;
          const completionTokens = chunk.usage.completion_tokens ?? 0;
          usage = {
            promptTokens,
            completionTokens,
            totalTokens:
              chunk.usage.total_tokens ?? promptTokens + completionTokens,
          };
        }
      }

      const toolCalls: AgentToolCall[] = [...calls.values()]
        .filter((call) => call.name)
        .map((call, index) => {
          let args: Record<string, unknown> = {};
          try {
            args = call.args ? (JSON.parse(call.args) as Record<string, unknown>) : {};
          } catch {
            args = {};
          }
          return {
            id: call.id ?? `call_${index}`,
            name: call.name ?? "",
            arguments: args,
          };
        });

      return { text, toolCalls, usage };
    },
  };
}
