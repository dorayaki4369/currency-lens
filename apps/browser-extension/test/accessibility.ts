import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { formatAccessibilityViolations, WCAG_AA_TAGS } from "@/test/accessibility-rules";

type AxeInclude = Parameters<AxeBuilder["include"]>[0];

interface AccessibilityCheckOptions {
  readonly attachmentName?: string | undefined;
  readonly include?: AxeInclude | undefined;
}

/** Fails on automatically detectable WCAG AA or common best-practice violations. */
export async function expectNoAutomatedAccessibilityViolations(
  page: Page,
  testInfo: TestInfo,
  options: Readonly<AccessibilityCheckOptions> = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_AA_TAGS]);
  if (options.include !== undefined) {
    builder = builder.include(options.include);
  }

  const results = await builder.analyze();
  await testInfo.attach(options.attachmentName ?? "axe-results", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  expect(results.violations.length, formatAccessibilityViolations(results.violations)).toBe(
    0,
  );
}
