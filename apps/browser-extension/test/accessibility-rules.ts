import type { Result } from "axe-core";

export const WCAG_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
] as const;

/** Summarizes rule identifiers and targets without snapshotting axe implementation details. */
export function formatAccessibilityViolations(violations: readonly Result[]): string {
  if (violations.length === 0) {
    return "No automatically detectable accessibility violations";
  }

  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `  ${JSON.stringify(node.target)}`)
        .join("\n");
      return `${violation.id}: ${violation.help}\n${targets}`;
    })
    .join("\n\n");
}
