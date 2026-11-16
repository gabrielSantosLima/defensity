import type { Workspace } from "../../../shared/types";

export interface WorkspaceRepository {
  list(): Workspace[];
  get(id: string): Workspace | null;
  insert(workspace: Workspace): void;
  archive(id: string, at: string): void;
}
