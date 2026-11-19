import type { SandboxBuildResult } from "../../../shared/types";
import type { SandboxService } from "../../services/sandboxService";

export class BuildSandboxImagesUseCase {
  constructor(private readonly sandbox: SandboxService) {}

  execute(onProgress: (chunk: string) => void): Promise<SandboxBuildResult> {
    return this.sandbox.buildImages(onProgress);
  }
}
