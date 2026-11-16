import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Fingerprint } from "../../domain/ports/fingerprint";

export const fingerprintPath: Fingerprint = async (target) => {
  try {
    const info = await stat(target);
    if (!info.isFile()) {
      return { hash: null, size: null };
    }
    const hash = await new Promise<string>((resolve, reject) => {
      const digest = createHash("sha256");
      createReadStream(target)
        .on("data", (chunk) => digest.update(chunk))
        .on("end", () => resolve(digest.digest("hex")))
        .on("error", reject);
    });
    return { hash, size: info.size };
  } catch {
    return { hash: null, size: null };
  }
};
