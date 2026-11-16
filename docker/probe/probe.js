const spec = JSON.parse(process.env.PROBE_SPEC || "{}");
const base = new URL(spec.baseUrl);
const timeoutMs = Math.min(Number(spec.timeoutMs) || 5000, 10000);

async function run(request, index) {
  const started = Date.now();
  try {
    const target = new URL(request.path || "/", base);
    if (target.host !== base.host) {
      return { index, error: `out of scope: ${target.host}` };
    }
    const response = await fetch(target, {
      method: request.method || "GET",
      headers: { "user-agent": "defensity/0.0.0", ...(request.headers || {}) },
      body: request.body || undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    return {
      index,
      identity: request.identity || "anonymous",
      method: request.method || "GET",
      path: target.pathname + target.search,
      status: response.status,
      location: response.headers.get("location"),
      ms: Date.now() - started,
      body: text.slice(0, 600),
    };
  } catch (error) {
    const cause = error && error.cause ? error.cause.code : null;
    const message = error instanceof Error ? error.message : String(error);
    return {
      index,
      identity: request.identity || "anonymous",
      method: request.method || "GET",
      path: request.path || "/",
      error: cause ? `${message} (${cause})` : message,
      ms: Date.now() - started,
    };
  }
}

const results = [];
for (let index = 0; index < (spec.requests || []).length; index += 1) {
  results.push(await run(spec.requests[index], index));
}

process.stdout.write(JSON.stringify({ results }) + "\n");
