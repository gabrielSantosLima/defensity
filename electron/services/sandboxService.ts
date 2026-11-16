import { spawnSync } from "node:child_process";

const IMAGES = ["defensity/probe:1", "defensity/load:1"];

export interface SandboxService {
  preflight(): void;
}

export function createSandboxService(): SandboxService {
  return {
    preflight() {
      const version = spawnSync(
        "docker",
        ["version", "--format", "{{.Server.Version}}"],
        { encoding: "utf8" },
      );
      if (version.status !== 0) {
        throw new Error(
          "Docker is required for validation and is not reachable. Start Docker and try again.",
        );
      }

      for (const image of IMAGES) {
        const result = spawnSync("docker", ["image", "inspect", image], {
          stdio: "ignore",
        });
        if (result.status !== 0) {
          throw new Error(
            `Sandbox image ${image} is missing. Run "npm run sandbox:build" once.`,
          );
        }
      }
    },
  };
}
