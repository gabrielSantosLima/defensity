import path from "node:path";
import { utilityProcess } from "electron";
import type {
  AgentInbound,
  AgentOutbound,
  AgentStartPayload as WireStartPayload,
} from "../agent/types";
import type { Run, RunStatus } from "../../shared/types";

export interface AgentHandlers {
  onEvent(
    runId: string,
    type: Extract<AgentOutbound, { kind: "event" }>["type"],
    payload: Record<string, unknown>,
  ): void;
  onDelta(runId: string, text: string): void;
  onFinish(
    runId: string,
    status: Extract<RunStatus, "completed" | "failed" | "cancelled">,
    error: string | undefined,
    steps: number | undefined,
  ): void;
}

export interface AgentStartPayload {
  run: Run;
  workspace: {
    id: string;
    name: string;
    type: string;
    targetUrl: string | null;
    targetApkPath: string | null;
    libraryArtifactPath: string | null;
    sourcePath: string | null;
    docsPath: string | null;
  };
  apiKey: string;
  baseUrl: string;
  limits: { maxToolResultChars: number; budget: number; maxTokens: number };
  seed?: string;
  allowInvalidCertificates: boolean;
}

export interface AgentService {
  start(payload: AgentStartPayload): void;
  cancel(runId: string): void;
  dispose(): void;
}

interface ChildLike {
  postMessage(message: AgentInbound): void;
  kill(): boolean;
  on(event: "message", listener: (message: AgentOutbound) => void): void;
  on(event: "exit", listener: (code: number) => void): void;
}

export function createAgentService(handlers: AgentHandlers): AgentService {
  const children = new Map<string, ChildLike>();
  const finished = new Set<string>();

  return {
    start(payload) {
      const wire: WireStartPayload = {
        runId: payload.run.id,
        provider: payload.run.provider ?? "compatible",
        model: payload.run.model ?? "",
        thinking: payload.run.thinking,
        apiKey: payload.apiKey,
        baseUrl: payload.baseUrl,
        workspace: payload.workspace as WireStartPayload["workspace"],
        limits: payload.limits,
        seed: payload.seed,
        allowInvalidCertificates: payload.allowInvalidCertificates,
      };

      const entry = path.join(__dirname, "..", "agent", "index.js");
      const child = utilityProcess.fork(entry, [], {
        serviceName: "defensity-agent",
      }) as unknown as ChildLike;

      children.set(payload.run.id, child);

      child.on("message", (message) => {
        if (message.kind === "delta") {
          handlers.onDelta(payload.run.id, message.text);
          return;
        }
        if (message.kind === "event") {
          handlers.onEvent(payload.run.id, message.type, message.payload);
          return;
        }
        if (!finished.has(payload.run.id)) {
          finished.add(payload.run.id);
          handlers.onFinish(
            payload.run.id,
            message.status,
            message.error,
            message.steps,
          );
        }
      });

      child.on("exit", () => {
        children.delete(payload.run.id);
        if (!finished.has(payload.run.id)) {
          finished.add(payload.run.id);
          handlers.onFinish(
            payload.run.id,
            "failed",
            "The agent process exited unexpectedly",
            undefined,
          );
        }
      });

      child.postMessage({ kind: "start", payload: wire });
    },

    cancel(runId) {
      const child = children.get(runId);
      if (!child) {
        return;
      }
      child.postMessage({ kind: "cancel" });
      const timer = setTimeout(() => {
        if (children.has(runId)) {
          const active = children.get(runId);
          children.delete(runId);
          active?.kill();
        }
      }, 4000);
      timer.unref?.();
    },

    dispose() {
      for (const child of children.values()) {
        try {
          child.kill();
        } catch {
          // ignore
        }
      }
      children.clear();
    },
  };
}
