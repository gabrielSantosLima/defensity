import type { Tool, ToolResult } from "./types";
import { containerName, containerUrl, runDocker, tail } from "./sandbox";

const MAX_REQUESTS = 10;

interface ProbeRequest {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: string;
  identity?: string;
}

export const probeRunTool: Tool = {
  definition: {
    name: "probe_run",
    description:
      "Execute up to ten bounded HTTP requests from the sandbox against the workspace target. Same host only. Returns status, timing and a short body per request.",
    parameters: {
      type: "object",
      properties: {
        requests: {
          type: "array",
          maxItems: MAX_REQUESTS,
          items: {
            type: "object",
            properties: {
              method: { type: "string", enum: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] },
              path: { type: "string" },
              identity: { type: "string", description: "Label such as anonymous or user-a" },
              headers: { type: "object", additionalProperties: { type: "string" } },
              body: { type: "string" },
            },
            required: ["path"],
          },
        },
      },
      required: ["requests"],
      additionalProperties: false,
    },
  },

  async execute(args, context): Promise<ToolResult> {
    if (!context.targetUrl) {
      return { ok: false, content: "This workspace has no web target." };
    }

    const requests = Array.isArray(args.requests)
      ? (args.requests as ProbeRequest[]).slice(0, MAX_REQUESTS)
      : [];
    if (requests.length === 0) {
      return { ok: false, content: "requests must contain at least one entry" };
    }

    const spec = {
      baseUrl: containerUrl(context.targetUrl),
      timeoutMs: 5000,
      requests: requests.map((request) => ({
        method: (request.method ?? "GET").toUpperCase(),
        path: request.path ?? "/",
        headers: request.headers ?? {},
        body: request.body,
        identity: request.identity ?? "anonymous",
      })),
    };

    const name = containerName("probe");
    const result = await runDocker(
      [
        "run",
        "--rm",
        "--name",
        name,
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--memory",
        "256m",
        "--cpus",
        "0.5",
        "--pids-limit",
        "64",
        "--add-host",
        "host.docker.internal:host-gateway",
        "-e",
        `PROBE_SPEC=${JSON.stringify(spec)}`,
        ...(context.allowInvalidCertificates
          ? ["-e", "NODE_TLS_REJECT_UNAUTHORIZED=0"]
          : []),
        "defensity/probe:1",
      ],
      60000,
      name,
      context.dockerHost,
    );

    if (result.timedOut) {
      return { ok: false, content: "The probe container timed out." };
    }
    if (result.code !== 0) {
      return {
        ok: false,
        content: `Probe failed (exit ${result.code}): ${tail(result.stderr)}`,
      };
    }

    const lastLine = result.stdout.trim().split(/\r?\n/).pop() ?? "";
    let parsed: {
      results?: Array<{
        index: number;
        identity?: string;
        method?: string;
        path?: string;
        status?: number;
        error?: string;
        ms?: number;
        body?: string;
      }>;
    };
    try {
      parsed = JSON.parse(lastLine) as typeof parsed;
    } catch {
      return { ok: false, content: `Unreadable probe output: ${tail(result.stdout)}` };
    }

    const lines = (parsed.results ?? []).map((entry) => {
      const head = `${entry.identity ?? "anonymous"} ${entry.method ?? "GET"} ${entry.path ?? "/"}`;
      if (entry.error) {
        return `- ${head} → error: ${entry.error} (${entry.ms ?? 0} ms)`;
      }
      const body = entry.body ? `\n  body: ${entry.body.replace(/\s+/g, " ").slice(0, 300)}` : "";
      return `- ${head} → ${entry.status} (${entry.ms ?? 0} ms)${body}`;
    });

    return { ok: true, content: lines.join("\n") || "No results." };
  },
};
