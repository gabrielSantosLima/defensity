import type { Tool, ToolResult } from "./types";
import { containerName, containerUrl, runDocker, tail } from "./sandbox";

const MAX_RATE = 20;
const MIN_DURATION = 5;
const MAX_DURATION = 30;
const MAX_MOUNT_BYTES = 4 * 1024 * 1024;

function metric(stdout: string, label: string): number | null {
  const match = stdout.match(new RegExp(`${label}[^|]*\\|\\s*(\\d+)`, "i"));
  return match ? Number(match[1]) : null;
}

export const loadRunTool: Tool = {
  definition: {
    name: "load_run",
    description:
      "Run a bounded Gatling load scenario from the sandbox against the workspace target and return request, error and latency metrics.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target path, default /" },
        usersPerSecond: { type: "integer", minimum: 1, maximum: MAX_RATE },
        durationSeconds: {
          type: "integer",
          minimum: MIN_DURATION,
          maximum: MAX_DURATION,
        },
      },
      additionalProperties: false,
    },
  },

  async execute(args, context): Promise<ToolResult> {
    if (!context.targetUrl) {
      return { ok: false, content: "This workspace has no web target." };
    }

    const rate = Math.min(
      MAX_RATE,
      Math.max(1, Math.round(Number(args.usersPerSecond ?? 5))),
    );
    const duration = Math.min(
      MAX_DURATION,
      Math.max(MIN_DURATION, Math.round(Number(args.durationSeconds ?? 10))),
    );
    const requestPath =
      typeof args.path === "string" && args.path.startsWith("/")
        ? args.path
        : "/";

    const name = containerName("load");
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
        "768m",
        "--cpus",
        "1",
        "--pids-limit",
        "128",
        "--add-host",
        "host.docker.internal:host-gateway",
        "-e",
        `TARGET_URL=${containerUrl(context.targetUrl)}`,
        "-e",
        `TARGET_PATH=${requestPath}`,
        "-e",
        `USERS_PER_SECOND=${rate}`,
        "-e",
        `DURATION_SECONDS=${duration}`,
        "defensity/load:1",
      ],
      (duration + 180) * 1000,
      name,
      context.dockerHost,
    );

    if (result.timedOut) {
      return { ok: false, content: "The load container timed out." };
    }
    if (result.code !== 0) {
      return {
        ok: false,
        content: `Load run failed (exit ${result.code}).\n${tail(result.stdout || result.stderr, 800)}`,
      };
    }

    const requests = metric(result.stdout, "request count");
    const mean = metric(result.stdout, "mean response time \\(ms\\)");
    const p95 = metric(result.stdout, "95th percentile \\(ms\\)");
    const max = metric(result.stdout, "max response time \\(ms\\)");
    const koMatch = result.stdout.match(/^\s*>\s*KO\b[^\n]*?(\d+)\s*\(/m);
    const ko = koMatch ? Number(koMatch[1]) : null;

    if (requests === null || mean === null) {
      return {
        ok: false,
        content: `Could not read Gatling metrics.\n${tail(result.stdout, 1200)}`,
      };
    }

    const errorRate =
      ko !== null && requests > 0
        ? `${((ko / requests) * 100).toFixed(1)}%`
        : "unknown";

    return {
      ok: true,
      content: [
        `requests: ${requests}`,
        `errors: ${ko ?? "unknown"} (${errorRate})`,
        `latency ms: mean ${mean}, p95 ${p95 ?? "unknown"}, max ${max ?? "unknown"}`,
        `scenario: ${rate} users/s for ${duration}s on ${requestPath}`,
      ].join("\n"),
    };
  },
};
