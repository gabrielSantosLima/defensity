import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import type {
  SandboxBuildResult,
  SandboxImage,
  SandboxStatus,
} from "../../shared/types";

const IMAGES = [
  { tag: "defensity/probe:1", context: "probe" },
  { tag: "defensity/load:1", context: "load" },
] as const;

export interface SandboxDeps {
  /** Directory that contains the probe and load build contexts. */
  dockerRoot: string;
  /** Empty string means the Docker CLI default. */
  dockerHost: () => string;
}

export interface SandboxService {
  status(): SandboxStatus;
  buildImages(onProgress: (chunk: string) => void): Promise<SandboxBuildResult>;
  preflight(): void;
}

function dockerEnv(dockerHost: string): NodeJS.ProcessEnv {
  const host = dockerHost.trim();
  return host ? { ...process.env, DOCKER_HOST: host } : process.env;
}

function lastLines(text: string, lines = 4): string {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-lines)
    .join("\n");
}

export function createSandboxService({
  dockerRoot,
  dockerHost,
}: SandboxDeps): SandboxService {
  function status(): SandboxStatus {
    const env = dockerEnv(dockerHost());
    const versionResult = spawnSync(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      { encoding: "utf8", env, timeout: 15000 },
    );
    const version = versionResult.stdout?.trim() || null;
    const dockerAvailable = versionResult.status === 0 && Boolean(version);

    if (!dockerAvailable) {
      const detail =
        lastLines(versionResult.stderr ?? "") ||
        versionResult.error?.message ||
        "docker version did not return a server version";
      return {
        dockerAvailable: false,
        version: null,
        ready: false,
        images: IMAGES.map(({ tag }) => ({ tag, present: false })),
        error: `Docker is not reachable. ${detail}`,
      };
    }

    const images: SandboxImage[] = IMAGES.map(({ tag }) => {
      const inspect = spawnSync("docker", ["image", "inspect", tag], {
        stdio: "ignore",
        env,
        timeout: 15000,
      });
      return { tag, present: inspect.status === 0 };
    });

    return {
      dockerAvailable: true,
      version,
      ready: images.every((image) => image.present),
      images,
      error: null,
    };
  }

  function buildOne(
    tag: string,
    context: string,
    env: NodeJS.ProcessEnv,
    onProgress: (chunk: string) => void,
  ): Promise<{ ok: boolean; error: string | null }> {
    return new Promise((resolve) => {
      const child = spawn(
        "docker",
        ["build", "--progress=plain", "-t", tag, context],
        { windowsHide: true, env },
      );
      let stderr = "";
      let settled = false;

      const forward = (chunk: Buffer) => {
        const text = chunk.toString();
        onProgress(text);
      };

      child.stdout.on("data", forward);
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        forward(chunk);
      });
      child.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({ ok: false, error: error.message });
      });
      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(
          code === 0
            ? { ok: true, error: null }
            : {
                ok: false,
                error: `Failed to build ${tag}: ${lastLines(stderr) || `exit ${code}`}`,
              },
        );
      });
    });
  }

  return {
    status,

    async buildImages(onProgress) {
      const current = status();
      if (!current.dockerAvailable) {
        return { ok: false, error: current.error, status: current };
      }

      const env = dockerEnv(dockerHost());
      for (const image of IMAGES) {
        const context = path.join(dockerRoot, image.context);
        onProgress(`Building ${image.tag} from ${context}\n`);
        const result = await buildOne(image.tag, context, env, onProgress);
        if (!result.ok) {
          return { ok: false, error: result.error, status: status() };
        }
        onProgress(`Built ${image.tag}\n`);
      }

      const updated = status();
      return {
        ok: updated.ready,
        error: updated.ready
          ? null
          : "The Docker build finished but the sandbox images are still not available.",
        status: updated,
      };
    },

    preflight() {
      const current = status();
      if (!current.dockerAvailable) {
        throw new Error(
          "Docker is required for web validation and is not reachable. Start Docker, then open Settings → Validation sandbox and check the connection.",
        );
      }
      const missing = current.images
        .filter((image) => !image.present)
        .map((image) => image.tag);
      if (missing.length > 0) {
        throw new Error(
          `Sandbox images are missing (${missing.join(", ")}). Open Settings → Validation sandbox and choose "Build images".`,
        );
      }
    },
  };
}
