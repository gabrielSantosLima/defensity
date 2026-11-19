import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

/**
 * A tiny intentionally vulnerable target used by the probe integration test.
 * It exposes an unauthenticated user endpoint (IDOR) and echoes a SQL statement.
 */
export function createSampleApp() {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/") {
      return json(response, 200, {
        app: "defensity-sample",
        version: "1.0.0",
        endpoints: ["/api/users/1", "/api/users/2", "/api/search?q="],
      });
    }
    if (url.pathname === "/api/users/1" || url.pathname === "/api/users/2") {
      const id = Number(url.pathname.split("/").pop());
      return json(response, 200, {
        id,
        name: id === 1 ? "Alice" : "Bob",
        email: id === 1 ? "alice@example.test" : "bob@example.test",
        role: id === 1 ? "admin" : "user",
      });
    }
    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q") ?? "";
      return json(response, 200, {
        query,
        rows: [],
        debug: `SELECT * FROM users WHERE name LIKE '%${query}%'`,
      });
    }
    response.setHeader("server", "defensity-sample/1.0.0");
    return json(response, 404, { error: "not found" });
  });
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const port = Number(process.env.PORT ?? 4789);
  createSampleApp().listen(port, "127.0.0.1", () => {
    process.stdout.write(`sample app listening on http://127.0.0.1:${port}\n`);
  });
}
