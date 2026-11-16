export async function* sseData(response: Response): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error("The provider returned an empty stream");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data) {
            yield data;
          }
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export async function assertOk(
  response: Response,
  provider: string,
): Promise<void> {
  if (response.ok) {
    return;
  }
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    // ignore
  }
  throw new Error(
    `${provider} refused the request (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
  );
}

export function estimateUsage(text: string): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const completionTokens = Math.max(1, Math.ceil(text.length / 4));
  return {
    promptTokens: 0,
    completionTokens,
    totalTokens: completionTokens,
  };
}
