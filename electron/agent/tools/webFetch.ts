import { stringArg } from "./args";
import type { Tool, ToolResult } from "./types";

const MAX_BODY_CHARS = 4000;
const TIMEOUT_MS = 10000;
const INTERESTING_HEADERS = [
  "content-type",
  "server",
  "x-powered-by",
  "strict-transport-security",
  "content-security-policy",
  "access-control-allow-origin",
  "location",
];

export const webFetchTool: Tool = {
  definition: {
    name: "web_fetch",
    description:
      "Fetch a path or absolute URL from the workspace target. Same host only. Returns status, headers and a text excerpt.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path starting with / or an absolute URL on the same host",
        },
      },
      additionalProperties: false,
    },
  },

  async execute(args, context): Promise<ToolResult> {
    if (!context.targetUrl) {
      return {
        ok: false,
        content: "This workspace has no web target.",
      };
    }

    let base: URL;
    try {
      base = new URL(context.targetUrl);
    } catch {
      return { ok: false, content: "The workspace target URL is invalid." };
    }

    const requested = stringArg(args, "path") ?? "/";
    let target: URL;
    try {
      target = new URL(requested, base);
    } catch {
      return { ok: false, content: "Invalid URL." };
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return { ok: false, content: "Only http and https are allowed." };
    }
    if (target.host !== base.host) {
      return {
        ok: false,
        content: `Out of scope: ${target.host} is not ${base.host}.`,
      };
    }

    let response: Response;
    try {
      response = await fetch(target, {
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "defensity/0.0.0" },
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause?.code;
      const reason =
        error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        content: `Request failed: ${reason}${cause ? ` (${cause})` : ""}. Check that the target is running and reachable.`,
      };
    }

    const finalUrl = new URL(response.url);
    if (finalUrl.host !== base.host) {
      return {
        ok: false,
        content: `Redirected out of scope to ${finalUrl.host}.`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "unknown";
    const headerLines = INTERESTING_HEADERS.map((name) => {
      const value = response.headers.get(name);
      return value ? `${name}: ${value}` : null;
    }).filter(Boolean);
    const cookies = response.headers.getSetCookie?.().length ?? 0;
    if (cookies > 0) {
      headerLines.push(`set-cookie: ${cookies} cookie(s) omitted`);
    }

    const head = `HTTP ${response.status}\n${headerLines.join("\n")}`;

    if (!/text|json|xml|javascript|html/i.test(contentType)) {
      return {
        ok: true,
        content: `${head}\n\n(${contentType} body omitted)`,
      };
    }

    const body = await response.text();
    return {
      ok: true,
      content: `${head}\n\n${body.slice(0, MAX_BODY_CHARS)}${
        body.length > MAX_BODY_CHARS ? "\n… (truncated)" : ""
      }`,
    };
  },
};
