import path from "node:path";

/** Resolves a model-provided path and refuses anything outside the allowed root. */
export function resolveInside(root: string, relative: string): string {
  const target = path.resolve(root, relative);
  const relation = path.relative(root, target);
  if (relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new Error("Path escapes the allowed root");
  }
  return target;
}
