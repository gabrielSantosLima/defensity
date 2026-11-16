import type {
  AgentMessage,
  AgentToolCall,
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderConfig,
  Usage,
} from "../types";
import { assertOk, sseData } from "./sse";

type AnthropicBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: "tool_result"; tool_use_id?: string; content: string };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicBlock[];
}

function toMessages(
  messages: AgentMessage[],
): { system: string; messages: AnthropicMessage[] } {
  const system: string[] = [];
  const output: AnthropicMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      system.push(message.content);
      continue;
    }
    if (message.role === "user") {
      output.push({
        role: "user",
        content: [{ type: "text", text: message.content }],
      });
      continue;
    }
    if (message.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (message.content) {
        blocks.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        });
      }
      output.push({ role: "assistant", content: blocks });
      continue;
    }

    const result: AnthropicBlock = {
      type: "tool_result",
      tool_use_id: message.toolCallId,
      content: message.content,
    };
    const last = output[output.length - 1];
    if (
      last?.role === "user" &&
      last.content.every((block) => block.type === "tool_result")
    ) {
      last.content.push(result);
    } else {
      output.push({ role: "user", content: [result] });
    }
  }

  return { system: system.join("\n\n"), messages: output };
}

export function createAnthropicProvider(config: ProviderConfig): ChatProvider {
  return {
    async chat(request: ChatRequest): Promise<ChatResult> {
      const converted = toMessages(request.messages);
      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: 4096,
        messages: converted.messages,
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
        stream: true,
      };
      if (converted.system) {
        body.system = converted.system;
      }

      const response = await fetch(`${config.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });
      await assertOk(response, "Anthropic");

      let text = "";
      let promptTokens = 0;
      let completionTokens = 0;
      const blocks = new Map<
        number,
        { id?: string; name?: string; json: string }
      >();

      for await (const data of sseData(response)) {
        const event = JSON.parse(data) as {
          type: string;
          index?: number;
          content_block?: { type: string; id?: string; name?: string };
          delta?: {
            type?: string;
            text?: string;
            partial_json?: string;
          };
          message?: { usage?: { input_tokens?: number } };
          usage?: { output_tokens?: number };
        };

        if (event.type === "message_start") {
          promptTokens = event.message?.usage?.input_tokens ?? 0;
        } else if (event.type === "content_block_start") {
          if (event.content_block?.type === "tool_use") {
            blocks.set(event.index ?? 0, {
              id: event.content_block.id,
              name: event.content_block.name,
              json: "",
            });
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta?.type === "text_delta" && event.delta.text) {
            text += event.delta.text;
            request.onDelta?.(event.delta.text);
          } else if (event.delta?.type === "input_json_delta") {
            const block = blocks.get(event.index ?? 0);
            if (block) {
              block.json += event.delta.partial_json ?? "";
            }
          }
        } else if (event.type === "message_delta") {
          completionTokens = event.usage?.output_tokens ?? completionTokens;
        }
      }

      const toolCalls: AgentToolCall[] = [...blocks.values()].map(
        (block, index) => {
          let args: Record<string, unknown> = {};
          try {
            args = block.json
              ? (JSON.parse(block.json) as Record<string, unknown>)
              : {};
          } catch {
            args = {};
          }
          return {
            id: block.id ?? `call_${index}`,
            name: block.name ?? "",
            arguments: args,
          };
        },
      );

      const usage: Usage | null =
        promptTokens || completionTokens
          ? {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            }
          : null;

      return { text, toolCalls, usage };
    },
  };
}
