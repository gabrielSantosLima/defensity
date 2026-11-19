import { spawn, spawnSync } from "node:child_process";

export interface DockerResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export function runDocker(
  args: string[],
  timeoutMs: number,
  name: string,
  dockerHost?: string,
): Promise<DockerResult> {
  return new Promise((resolve) => {
    const host = dockerHost?.trim();
    const child = spawn("docker", args, {
      windowsHide: true,
      env: host ? { ...process.env, DOCKER_HOST: host } : process.env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      spawnSync("docker", ["rm", "-f", name], {
        stdio: "ignore",
        env: host ? { ...process.env, DOCKER_HOST: host } : process.env,
      });
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: error.message, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}

/**
 * Containers reach the host through this name. Loopback targets are rewritten
 * so a validation container can hit a locally running service.
 */
export function containerUrl(target: string): string {
  const url = new URL(target);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    url.hostname = "host.docker.internal";
  }
  return url.toString();
}

export function containerName(prefix: string): string {
  return `defensity-${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function tail(text: string, length = 600): string {
  const trimmed = text.trim();
  return trimmed.length > length ? trimmed.slice(-length) : trimmed;
}
