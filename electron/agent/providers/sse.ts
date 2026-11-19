export const PROVIDER_RESPONSE_TIMEOUT_MS = 60_000;
export const PROVIDER_IDLE_TIMEOUT_MS = 90_000;

export async function* sseData(
  response: Response,
  idleTimeoutMs = PROVIDER_IDLE_TIMEOUT_MS,
): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error("The provider returned an empty stream");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let result: Awaited<ReturnType<typeof reader.read>>;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `The provider stopped streaming for ${idleTimeoutMs >= 1000 ? `${Math.round(idleTimeoutMs / 1000)}s` : `${idleTimeoutMs}ms`}. The run was aborted.`,
                ),
              ),
            idleTimeoutMs,
          );
        }),
      ]);
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }

    const { value, done } = result;
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

export class ProviderRequestError extends Error {
  constructor(
    provider: string,
    readonly status: number,
    detail: string,
  ) {
    super(
      `${provider} refused the request (HTTP ${status})${detail ? `: ${detail}` : ""}`,
    );
    this.name = "ProviderRequestError";
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
  throw new ProviderRequestError(provider, response.status, detail);
}

/**
 * Runs the request and waits for the response headers with a hard timeout. The
 * stream itself is covered by the idle timeout in sseData.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  provider: string,
  parent: AbortSignal,
  timeoutMs = PROVIDER_RESPONSE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (parent.aborted) {
    controller.abort();
  } else {
    parent.addEventListener("abort", abort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    await assertOk(response, provider);
    return response;
  } catch (error) {
    if (timedOut && !parent.aborted) {
      throw new Error(
        `${provider} did not respond within ${Math.round(timeoutMs / 1000)}s. The run was aborted.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    parent.removeEventListener("abort", abort);
  }
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
