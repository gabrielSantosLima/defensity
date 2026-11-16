import type {
  AgentEmit,
  AgentInbound,
  AgentOutbound,
  AgentStartPayload,
  Usage,
} from "./types";
import { runAgent } from "./orchestrator";

interface ParentPort {
  postMessage(message: AgentOutbound): void;
  on(event: "message", listener: (event: { data: AgentInbound }) => void): void;
}

const parentPort = (
  process as unknown as { parentPort?: ParentPort }
).parentPort;

if (!parentPort) {
  throw new Error("The agent must run inside an Electron utility process");
}

const port: ParentPort = parentPort;
const controller = new AbortController();

const tracked: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
let trackedSteps = 0;

const emit = ((type, payload) => {
  if (type === "usage") {
    tracked.promptTokens += Number(payload.promptTokens ?? 0);
    tracked.completionTokens += Number(payload.completionTokens ?? 0);
    tracked.totalTokens += Number(payload.totalTokens ?? 0);
  }
  if (type === "step.started") {
    trackedSteps = Number(payload.step ?? trackedSteps);
  }
  port.postMessage({ kind: "event", type, payload });
}) as AgentEmit;

emit.delta = (text: string) => {
  port.postMessage({ kind: "delta", text });
};

function totalUsage(): Usage {
  return {
    promptTokens: tracked.promptTokens,
    completionTokens: tracked.completionTokens,
    totalTokens: tracked.totalTokens || tracked.completionTokens,
  };
}

async function start(payload: AgentStartPayload): Promise<void> {
  try {
    const result = await runAgent(payload, emit, controller.signal);
    port.postMessage({
      kind: "finish",
      status: "completed",
      usage: result.usage,
      steps: result.steps,
    });
  } catch (error) {
    const cancelled = controller.signal.aborted;
    port.postMessage({
      kind: "finish",
      status: cancelled ? "cancelled" : "failed",
      error: cancelled
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error),
      usage: totalUsage(),
      steps: trackedSteps,
    });
  }
}

port.on("message", (event) => {
  const message = event.data;
  if (message.kind === "start") {
    void start(message.payload);
  } else if (message.kind === "cancel") {
    controller.abort();
  }
});
