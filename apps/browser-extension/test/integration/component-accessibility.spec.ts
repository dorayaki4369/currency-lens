import { describe, expect, it } from "vitest";
import { formatAccessibilityViolations } from "@/test/accessibility-rules";
import {
  findAccessibilityViolations,
  openComponentFixture,
  queryAll,
  saveReviewScreenshot,
} from "@/test/integration/browser-harness";
import { COMPONENT_FIXTURES } from "@/test/integration/component-fixtures/fixtures";

describe("component browser integration", () => {
  it.each(COMPONENT_FIXTURES.map((fixture) => fixture.id))(
    "renders %s in both themes without automatically detectable violations",
    async (fixtureId) => {
      await openComponentFixture(fixtureId);
      expectFixtureRenderingState(fixtureId);
      await saveReviewScreenshot(`component-${fixtureId}`);
      const failures: string[] = [];

      for (const theme of ["light", "dark"] as const) {
        // axe scans share one document, so each themed panel is checked in turn.
        // eslint-disable-next-line no-await-in-loop
        const violations = await findAccessibilityViolations({
          include: [`[data-fixture-theme="${theme}"] > div`],
        });
        if (violations.length > 0) {
          failures.push(`${theme}\n${formatAccessibilityViolations(violations)}`);
        }
      }

      expect(failures.length, failures.join("\n\n")).toBe(0);
    },
  );
});

/** Verifies each accessibility scan includes both themes and any requested open state. */
function expectFixtureRenderingState(fixtureId: string): void {
  const themePanels = queryAll("[data-fixture-theme]");
  expect(themePanels).toHaveLength(2);
  const themeBackgrounds = themePanels.map(
    (panel) => getComputedStyle(panel).backgroundColor,
  );
  expect(new Set(themeBackgrounds).size).toBe(2);

  if (fixtureId === "currency-combobox-open") {
    expect(queryAll('[data-slot="popover-content"]')).toHaveLength(2);
  }
  if (fixtureId === "hover-tooltip") {
    expect(queryAll('[data-slot="tooltip-content"]')).toHaveLength(2);
  }
}
