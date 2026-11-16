import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const images = [
  { tag: "defensity/probe:1", context: path.join(root, "docker", "probe") },
  { tag: "defensity/load:1", context: path.join(root, "docker", "load") },
];

for (const image of images) {
  console.log(`building ${image.tag}`);
  const result = spawnSync(
    "docker",
    ["build", "-t", image.tag, image.context],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(`failed to build ${image.tag}`);
    process.exit(result.status ?? 1);
  }
}

console.log("sandbox images ready");
