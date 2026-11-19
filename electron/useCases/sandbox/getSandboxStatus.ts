import type { SandboxStatus } from "../../../shared/types";
import type { SandboxService } from "../../services/sandboxService";

export class GetSandboxStatusUseCase {
  constructor(private readonly sandbox: SandboxService) {}

  execute(): SandboxStatus {
    return this.sandbox.status();
  }
}
