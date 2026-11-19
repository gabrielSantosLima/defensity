/**
 * Findings are deduplicated by title inside a workspace. The comparison ignores
 * case and repeated whitespace so a model cannot register the same issue twice
 * with cosmetic differences.
 */
export function normalizeFindingTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}
