import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { after, test } from "node:test";

import { createSampleApp } from "./fixtures/sample-app/server.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

const { buildConversationTranscript, buildRunContext } = require(
  "../dist/main/electron/useCases/runs/runContext.js",
);
const { findingRecordTool } = require(
  "../dist/main/electron/agent/tools/findingRecord.js",
);
const { probeRunTool } = require(
  "../dist/main/electron/agent/tools/probeRun.js",
);
const { createSandboxService } = require(
  "../dist/main/electron/services/sandboxService.js",
);
const { sseData } = require(
  "../dist/main/electron/agent/providers/sse.js",
);
const { ProviderRequestError } = require(
  "../dist/main/electron/agent/providers/sse.js",
);
const {
  buildSummaryTranscript,
  compactionCeiling,
  createCheckpointMessage,
  estimateMessages,
  isContextOverflowError,
  resolveContextWindow,
  splitConversation,
  tailTokenLimit,
} = require("../dist/main/electron/agent/compaction.js");
const { hypothesisListTool } = require(
  "../dist/main/electron/agent/tools/hypothesisList.js",
);
const { runAgent } = require(
  "../dist/main/electron/agent/orchestrator.js",
);
const { openDatabase } = require(
  "../dist/main/electron/services/db/database.js",
);
const { createWorkspaceService } = require(
  "../dist/main/electron/services/workspaceService.js",
);
const { createRunService } = require(
  "../dist/main/electron/services/runService.js",
);
const { createHypothesisService } = require(
  "../dist/main/electron/services/hypothesisService.js",
);
const { createFindingService } = require(
  "../dist/main/electron/services/findingService.js",
);
const { StartRunUseCase } = require(
  "../dist/main/electron/useCases/runs/startRun.js",
);
const { RecordRunEventUseCase } = require(
  "../dist/main/electron/useCases/runs/recordRunEvent.js",
);
const { DEFAULT_ENGINE_SETTINGS } = require(
  "../dist/main/electron/entities/settings.js",
);
const { normalizeEngineSettings } = require(
  "../dist/main/electron/entities/settings.js",
);

const temporaryDirs = [];

after(() => {
  for (const directory of temporaryDirs) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempDir() {
  const directory = mkdtempSync(path.join(tmpdir(), "defensity-test-"));
  temporaryDirs.push(directory);
  return directory;
}

const now = () => new Date().toISOString();

function finding(overrides = {}) {
  return {
    id: randomUUID(),
    runId: "run-1",
    hypothesisId: null,
    title: "IDOR on /api/users",
    severity: "high",
    class: "authz",
    evidence: "anonymous GET /api/users/1 returned another user",
    validator: "probe_run",
    status: "open",
    createdAt: now(),
    ...overrides,
  };
}

function hypothesis(overrides = {}) {
  return {
    id: randomUUID(),
    runId: "run-1",
    statement: "The users endpoint does not verify ownership",
    class: "authz",
    impact: 4,
    plausibility: 5,
    rationale: "the handler returns the row by id",
    evidence: "server.mjs:34",
    proposedTest: "request user 2 as anonymous",
    createdAt: now(),
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    id: randomUUID(),
    runId: "run-1",
    seq: 1,
    type: "assistant.message",
    payload: {},
    createdAt: now(),
    ...overrides,
  };
}

function agentPayload(directory, overrides = {}) {
  return {
    runId: "run-agent-test",
    provider: "openai",
    model: "model-4k",
    thinking: "off",
    apiKey: "test-key",
    baseUrl: "http://127.0.0.1:1",
    workspace: {
      id: "workspace-agent",
      name: "Agent test",
      type: "library",
      targetUrl: null,
      targetApkPath: null,
      libraryArtifactPath: null,
      sourcePath: directory,
      docsPath: null,
    },
    limits: { maxToolResultChars: 60_000 },
    allowInvalidCertificates: false,
    ...overrides,
  };
}

function createEmitter() {
  const events = [];
  const emit = (type, payload) => events.push({ type, payload });
  emit.delta = () => {};
  return { emit, events };
}

function summaryResponse(text = "## Objective\n- compressed summary") {
  return {
    text,
    toolCalls: [],
    usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 },
  };
}

test("run context carries existing issues and previous hypotheses", () => {
  const context = buildRunContext({
    issues: [
      finding(),
      finding({ id: randomUUID(), title: "IDOR  on   /api/users" }),
    ],
    hypotheses: [hypothesis()],
  });

  assert.ok(context);
  assert.match(context, /Existing validated issues/);
  assert.match(context, /IDOR on \/api\/users/);
  assert.match(context, /do not record them again/i);
  assert.match(context, /does not verify ownership/);
  assert.equal(context.match(/IDOR on \/api\/users/g).length, 1);
});

test("source conversation transcript includes assistant and tool events", () => {
  const transcript = buildConversationTranscript([
    event({ payload: { text: "I found an IDOR candidate." } }),
    event({
      type: "tool.call",
      payload: { name: "probe_run", arguments: { requests: [] } },
    }),
    event({
      type: "tool.result",
      payload: { name: "probe_run", ok: true, chars: 80, preview: "200 OK" },
    }),
  ]);

  assert.match(transcript, /assistant: I found an IDOR candidate/);
  assert.match(transcript, /tool call probe_run/);
  assert.match(transcript, /tool result \(ok, 80 chars\): 200 OK/);
});

test("finding_record refuses a title already registered in the workspace", async () => {
  const context = {
    root: null,
    targetUrl: null,
    libraryArtifactPath: null,
    allowInvalidCertificates: false,
    dockerHost: "",
    knownFindingTitles: new Set(["idor on /api/users"]),
    hypotheses: [],
    findings: [],
  };

  const duplicate = await findingRecordTool.execute(
    {
      title: "IDOR  on /API/Users",
      severity: "high",
      class: "authz",
      evidence: "GET /api/users/1",
      validator: "probe_run",
    },
    context,
  );
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.content, /already registered/i);

  const fresh = await findingRecordTool.execute(
    {
      title: "Reflected SQL error in search",
      severity: "medium",
      class: "injection",
      evidence: "GET /api/search?q='",
      validator: "probe_run",
    },
    context,
  );
  assert.equal(fresh.ok, true);
});

test("rerun seeds the source conversation and a fresh run keeps workspace knowledge", () => {
  const database = openDatabase(path.join(tempDir(), "defensity.db"));
  const workspaces = createWorkspaceService(database);
  const runs = createRunService(database);
  const hypotheses = createHypothesisService(database);
  const findings = createFindingService(database);
  const ids = { newId: () => randomUUID() };

  workspaces.insert({
    id: "workspace-1",
    name: "Sample app",
    type: "web",
    targetUrl: "http://127.0.0.1:4789",
    targetApkPath: null,
    libraryArtifactPath: null,
    libraryArtifactKind: null,
    sourcePath: path.join(root, "tests", "fixtures", "sample-app"),
    docsPath: null,
    provider: "openai",
    model: "gpt-test",
    thinking: "off",
    authorizedAt: now(),
    authorizationNote: "test fixture",
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
    artifacts: [],
  });

  const source = {
    id: "run-1",
    workspaceId: "workspace-1",
    status: "completed",
    provider: "openai",
    model: "gpt-test",
    thinking: "off",
    startedAt: now(),
    endedAt: now(),
    error: null,
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    stepCount: 3,
    rerunOf: null,
    createdAt: now(),
  };
  runs.create(source);

  const issue = finding({ runId: source.id });
  const explored = hypothesis({ runId: source.id });
  findings.insert(issue);
  hypotheses.insert(explored);

  runs.appendEvent({
    id: randomUUID(),
    runId: source.id,
    type: "assistant.message",
    payload: { text: "I found an IDOR candidate in /api/users/1." },
    createdAt: now(),
  });
  runs.appendEvent({
    id: randomUUID(),
    runId: source.id,
    type: "tool.call",
    payload: { name: "probe_run", arguments: { requests: [{ path: "/api/users/1" }] } },
    createdAt: now(),
  });
  runs.appendEvent({
    id: randomUUID(),
    runId: source.id,
    type: "tool.result",
    payload: {
      name: "probe_run",
      ok: true,
      chars: 90,
      preview: "anonymous GET /api/users/1 → 200",
    },
    createdAt: now(),
  });

  let captured = null;
  const startRun = new StartRunUseCase({
    workspaces,
    runs,
    secrets: { read: () => "test-key" },
    settings: { get: () => ({ ...DEFAULT_ENGINE_SETTINGS }) },
    agent: {
      start: (payload) => {
        captured = payload;
      },
      cancel: () => {},
      dispose: () => {},
    },
    sandbox: { preflight: () => {} },
    hypotheses,
    findings,
    clock: { now },
    ids,
  });

  const rerun = startRun.execute("workspace-1", { rerunOf: source.id });
  assert.equal(rerun.rerunOf, source.id);
  assert.ok(captured.seed.includes("Source conversation from run run-1"));
  assert.ok(captured.seed.includes("I found an IDOR candidate"));
  assert.ok(captured.seed.includes(issue.title));
  assert.ok(captured.seed.includes(explored.statement));
  assert.deepEqual(
    captured.knownFindings.map((finding) => finding.title),
    [issue.title],
  );
  assert.deepEqual(
    captured.knownHypotheses.map((hypothesis) => hypothesis.statement),
    [explored.statement],
  );

  runs.setStatus(rerun.id, "completed", { endedAt: now() });
  captured = null;
  startRun.execute("workspace-1");
  assert.ok(captured.seed.includes(issue.title));
  assert.ok(captured.seed.includes(explored.statement));
  assert.ok(!captured.seed.includes("Source conversation from run"));
  assert.deepEqual(
    captured.knownFindings.map((finding) => finding.title),
    [issue.title],
  );
  assert.deepEqual(
    captured.knownHypotheses.map((hypothesis) => hypothesis.statement),
    [explored.statement],
  );

  database.close();
});

test("recordRunEvent refuses to register the same issue twice", () => {
  const database = openDatabase(path.join(tempDir(), "defensity.db"));
  const workspaces = createWorkspaceService(database);
  const runs = createRunService(database);
  const hypotheses = createHypothesisService(database);
  const findings = createFindingService(database);
  const ids = { newId: () => randomUUID() };

  workspaces.insert({
    id: "workspace-2",
    name: "Sample app 2",
    type: "library",
    targetUrl: null,
    targetApkPath: null,
    libraryArtifactPath: path.join(root, "package-lock.json"),
    libraryArtifactKind: "lockfile",
    sourcePath: null,
    docsPath: null,
    provider: "openai",
    model: "gpt-test",
    thinking: "off",
    authorizedAt: now(),
    authorizationNote: "test fixture",
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
    artifacts: [],
  });

  runs.create({
    id: "run-2",
    workspaceId: "workspace-2",
    status: "completed",
    provider: "openai",
    model: "gpt-test",
    thinking: "off",
    startedAt: now(),
    endedAt: now(),
    error: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    stepCount: 1,
    rerunOf: null,
    createdAt: now(),
  });

  const record = new RecordRunEventUseCase({
    runs,
    hypotheses,
    findings,
    clock: { now },
    ids,
  });

  const first = record.execute({
    runId: "run-2",
    type: "finding",
    payload: {
      title: "IDOR on /api/users",
      severity: "high",
      class: "authz",
      evidence: "GET /api/users/1",
      validator: "probe_run",
    },
  });
  assert.equal(first.payload.duplicate, undefined);
  assert.equal(findings.listByWorkspace("workspace-2").length, 1);

  const second = record.execute({
    runId: "run-2",
    type: "finding",
    payload: {
      title: "idor  ON /api/users",
      severity: "critical",
      class: "authz",
      evidence: "GET /api/users/2",
      validator: "probe_run",
    },
  });
  assert.equal(second.payload.duplicate, true);
  assert.equal(findings.listByWorkspace("workspace-2").length, 1);

  database.close();
});

test("close to tray is enabled by default and can be disabled", () => {
  assert.equal(normalizeEngineSettings({}).closeToTray, true);
  assert.equal(
    normalizeEngineSettings({ closeToTray: false }).closeToTray,
    false,
  );
});

test("sseData aborts a provider stream that stops sending data", async () => {
  const stream = new ReadableStream({
    start() {
      // Keep the stream open without producing data.
    },
  });
  const response = new Response(stream);

  await assert.rejects(async () => {
    for await (const _chunk of sseData(response, 50)) {
      // No chunks are expected.
    }
  }, /stopped streaming for 50ms/);
});

test("compaction sizing follows the model window without settings", () => {
  assert.equal(resolveContextWindow("openai", "gpt-4o"), 128_000);
  assert.equal(resolveContextWindow("gemini", "gemini-2.5-pro"), 1_000_000);
  assert.equal(resolveContextWindow("anthropic", "claude-4"), 200_000);
  assert.equal(resolveContextWindow("deepinfra", "model-256k"), 256_000);

  const window = 128_000;
  const ceiling = compactionCeiling(window);
  assert.equal(ceiling, 64_000);
  assert.ok(tailTokenLimit(window, ceiling) >= 2_000);
});

test("compaction keeps an exchange boundary and preserves the previous checkpoint", () => {
  const conversation = [
    { id: "u1", role: "user", content: "first question" },
    {
      id: "a1",
      role: "assistant",
      content: "first answer",
      toolCalls: [{ id: "c1", name: "fs_read", arguments: { path: "a.ts" } }],
    },
    {
      id: "t1",
      role: "tool",
      toolCallId: "c1",
      content: "tool output",
    },
    { id: "u2", role: "user", content: "recent question" },
    { id: "a2", role: "assistant", content: "recent answer" },
  ];
  const checkpoint = createCheckpointMessage("old checkpoint", "auto");
  const split = splitConversation([checkpoint, ...conversation], 8);

  assert.equal(split.previousSummary, "old checkpoint");
  assert.equal(split.tail[0].id, "u2");
  assert.ok(split.history.length > 0);
});

test("summary transcript drops detail from the oldest exchange", () => {
  const history = [
    { role: "user", content: "old question" },
    {
      role: "assistant",
      content: "old answer",
      toolCalls: [
        { id: "c1", name: "fs_read", arguments: { path: "old.ts" } },
      ],
    },
    {
      role: "tool",
      toolCallId: "c1",
      content: "x".repeat(20_000),
    },
    { role: "user", content: "newest question" },
    { role: "assistant", content: "newest answer" },
  ];
  const transcript = buildSummaryTranscript(history, 300);

  assert.ok(transcript);
  assert.ok(transcript.length < 4_000);
  assert.match(transcript, /newest question/);
  assert.match(transcript, /newest answer/);
});

test("context overflow is recognized from status and message", () => {
  assert.equal(isContextOverflowError(new ProviderRequestError("OpenAI", 413, "")), true);
  assert.equal(
    isContextOverflowError(new Error("maximum context length exceeded")),
    true,
  );
  assert.equal(isContextOverflowError(new ProviderRequestError("OpenAI", 500, "")), false);
  assert.equal(isContextOverflowError(new Error("network down")), false);
});

test("hypothesis_list exposes hypotheses and findings to the agent", async () => {
  const result = await hypothesisListTool.execute(
    {},
    {
      root: null,
      targetUrl: null,
      libraryArtifactPath: null,
      allowInvalidCertificates: false,
      dockerHost: "",
      knownFindingTitles: new Set(),
      hypotheses: [
        {
          statement: "The users endpoint does not verify ownership",
          class: "authz",
          impact: 4,
          plausibility: 5,
          rationale: "returns the row by id",
          evidence: "server.mjs:34",
          proposedTest: "request user 2 anonymously",
        },
      ],
      findings: [
        {
          title: "IDOR on /api/users",
          severity: "high",
          class: "authz",
          evidence: "anonymous GET /api/users/1 returned another user",
          validator: "probe_run",
        },
      ],
    },
  );

  assert.equal(result.ok, true);
  assert.match(result.content, /does not verify ownership/);
  assert.match(result.content, /IDOR on \/api\/users/);
  assert.match(result.content, /Hypotheses recorded \(1\)/);
  assert.match(result.content, /Validated findings \(1\)/);
});

test("runAgent compacts automatically before the next step", async () => {
  const directory = tempDir();
  writeFileSync(path.join(directory, "big.txt"), "x".repeat(20_000));
  const normalRequests = [];
  let normalCalls = 0;
  let summaryCalls = 0;
  const provider = {
    async chat(request) {
      if (request.tools.length === 0) {
        summaryCalls += 1;
        return summaryResponse("## Objective\n- automatic compaction summary");
      }
      normalCalls += 1;
      normalRequests.push(request.messages);
      if (normalCalls === 1) {
        return {
          text: "",
          toolCalls: [
            { id: "c1", name: "fs_read", arguments: { path: "big.txt" } },
          ],
          usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
        };
      }
      return {
        text: "analysis complete",
        toolCalls: [],
        usage: { promptTokens: 80, completionTokens: 5, totalTokens: 85 },
      };
    },
  };
  const { emit, events } = createEmitter();

  await runAgent(
    agentPayload(directory),
    emit,
    new AbortController().signal,
    provider,
  );

  assert.equal(summaryCalls, 1);
  const compaction = events.filter((item) => item.type === "compaction");
  assert.equal(compaction.length, 1);
  assert.equal(compaction[0].payload.mode, "auto");
  assert.match(compaction[0].payload.summary, /automatic compaction summary/);
  assert.ok(
    normalRequests[1].some(
      (message) =>
        message.kind === "checkpoint" &&
        message.content.includes("automatic compaction summary"),
    ),
  );
});

test("runAgent recovers from a provider context overflow", async () => {
  const directory = tempDir();
  writeFileSync(path.join(directory, "medium.txt"), "y".repeat(5_000));
  const normalRequests = [];
  let normalCalls = 0;
  let summaryCalls = 0;
  const provider = {
    async chat(request) {
      if (request.tools.length === 0) {
        summaryCalls += 1;
        return summaryResponse("## Objective\n- overflow summary");
      }
      normalCalls += 1;
      normalRequests.push(request.messages);
      if (normalCalls === 1) {
        return {
          text: "",
          toolCalls: [
            { id: "c1", name: "fs_read", arguments: { path: "medium.txt" } },
          ],
          usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
        };
      }
      if (normalCalls === 2) {
        throw new ProviderRequestError(
          "Fake",
          400,
          "maximum context length exceeded",
        );
      }
      return {
        text: "analysis complete",
        toolCalls: [],
        usage: { promptTokens: 60, completionTokens: 5, totalTokens: 65 },
      };
    },
  };
  const { emit, events } = createEmitter();

  await runAgent(
    agentPayload(directory),
    emit,
    new AbortController().signal,
    provider,
  );

  assert.equal(summaryCalls, 1);
  const compaction = events.filter((item) => item.type === "compaction");
  assert.equal(compaction.length, 1);
  assert.equal(compaction[0].payload.mode, "overflow");
  assert.match(compaction[0].payload.summary, /overflow summary/);
  assert.ok(
    normalRequests.at(-1).some((message) => message.kind === "checkpoint"),
  );
});

test("runAgent precomputes a summary without blocking the step", async () => {
  const directory = tempDir();
  writeFileSync(path.join(directory, "first.txt"), "a".repeat(12_000));
  writeFileSync(path.join(directory, "second.txt"), "b".repeat(12_000));
  const normalRequests = [];
  let normalCalls = 0;
  let summaryCalls = 0;
  let summaryStartedDuringStep = false;
  let summaryStarted = false;
  const provider = {
    async chat(request) {
      if (request.tools.length === 0) {
        summaryCalls += 1;
        summaryStarted = true;
        return summaryResponse("## Objective\n- background summary");
      }
      normalCalls += 1;
      normalRequests.push(request.messages);
      if (normalCalls === 2) {
        summaryStartedDuringStep = summaryStarted;
        return {
          text: "",
          toolCalls: [
            { id: "c2", name: "fs_read", arguments: { path: "second.txt" } },
          ],
          usage: { promptTokens: 3_200, completionTokens: 10, totalTokens: 3_210 },
        };
      }
      if (normalCalls === 1) {
        return {
          text: "",
          toolCalls: [
            { id: "c1", name: "fs_read", arguments: { path: "first.txt" } },
          ],
          usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
        };
      }
      return {
        text: "analysis complete",
        toolCalls: [],
        usage: { promptTokens: 80, completionTokens: 5, totalTokens: 85 },
      };
    },
  };
  const { emit, events } = createEmitter();

  await runAgent(
    agentPayload(directory),
    emit,
    new AbortController().signal,
    provider,
  );

  assert.equal(summaryStartedDuringStep, true);
  assert.equal(summaryCalls, 1);
  const compaction = events.filter((item) => item.type === "compaction");
  assert.equal(compaction.length, 1);
  assert.equal(compaction[0].payload.mode, "background");
  assert.equal(compaction[0].payload.usedBackground, true);
  assert.match(compaction[0].payload.summary, /background summary/);
  assert.ok(
    normalRequests.at(-1).some((message) => message.kind === "checkpoint"),
  );
});

test("runAgent nudges the agent out of the hypothesis phase", async () => {
  const directory = tempDir();
  const normalRequests = [];
  let normalCalls = 0;
  const provider = {
    async chat(request) {
      normalCalls += 1;
      normalRequests.push(request.messages);
      if (normalCalls === 1) {
        return {
          text: "",
          toolCalls: [
            {
              id: "h1",
              name: "hypothesis_record",
              arguments: {
                statement: "The search endpoint reflects SQL errors",
                class: "injection",
                impact: 4,
                plausibility: 4,
                rationale: "the query is interpolated into the response",
                evidence: "src/search.ts:42",
                proposedTest: "send a quote in q",
              },
            },
          ],
          usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
        };
      }
      if (normalCalls === 2) {
        return {
          text: "analysis complete",
          toolCalls: [],
          usage: { promptTokens: 80, completionTokens: 5, totalTokens: 85 },
        };
      }
      if (normalCalls === 3) {
        return {
          text: "",
          toolCalls: [
            {
              id: "f1",
              name: "finding_record",
              arguments: {
                title: "Reflected SQL error in search",
                severity: "medium",
                class: "injection",
                evidence: "GET /api/search?q=' returned the SQL statement",
                validator: "probe_run",
              },
            },
          ],
          usage: { promptTokens: 90, completionTokens: 8, totalTokens: 98 },
        };
      }
      return {
        text: "analysis complete",
        toolCalls: [],
        usage: { promptTokens: 70, completionTokens: 5, totalTokens: 75 },
      };
    },
  };
  const { emit, events } = createEmitter();

  await runAgent(
    agentPayload(directory),
    emit,
    new AbortController().signal,
    provider,
  );

  assert.equal(normalCalls, 4);
  assert.ok(
    normalRequests[2].some(
      (message) =>
        message.role === "user" &&
        message.content.includes("Do not stop at the hypothesis phase"),
    ),
  );
  assert.equal(
    events.filter((item) => item.type === "finding").length,
    1,
  );
});

test("sandbox status has a stable shape and preflight matches it", () => {
  const sandbox = createSandboxService({
    dockerRoot: path.join(root, "docker"),
    dockerHost: () => "",
  });
  const status = sandbox.status();

  assert.equal(typeof status.ready, "boolean");
  assert.equal(typeof status.dockerAvailable, "boolean");
  assert.equal(status.images.length, 2);
  if (status.dockerAvailable) {
    assert.equal(status.error, null);
    if (status.ready) {
      assert.doesNotThrow(() => sandbox.preflight());
    } else {
      assert.throws(() => sandbox.preflight(), /Settings/);
    }
  } else {
    assert.match(status.error ?? "", /Docker is not reachable/);
    assert.throws(() => sandbox.preflight(), /Settings/);
  }
});

test("probe container reaches the sample app", async (t) => {
  const sandbox = createSandboxService({
    dockerRoot: path.join(root, "docker"),
    dockerHost: () => "",
  });
  const status = sandbox.status();
  if (!status.dockerAvailable || !status.ready) {
    t.skip("Docker or the sandbox images are not available");
    return;
  }

  const server = createSampleApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const result = await probeRunTool.execute(
      {
        requests: [
          { path: "/api/users/1", identity: "anonymous" },
          { path: "/api/search?q=alice", identity: "anonymous" },
        ],
      },
      {
        root: null,
        targetUrl: `http://127.0.0.1:${port}`,
        libraryArtifactPath: null,
        allowInvalidCertificates: false,
        dockerHost: "",
        knownFindingTitles: new Set(),
        hypotheses: [],
        findings: [],
      },
    );

    assert.equal(result.ok, true, result.content);
    assert.match(result.content, /anonymous GET \/api\/users\/1 → 200/);
    assert.match(result.content, /SELECT \* FROM users/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
