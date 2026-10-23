import type { CrossTreeSelector, LabelledShadowDomSelector } from "axe-core";
import { expect, it } from "vitest";
import type { Config } from "@/lib/currency";
import { page, userEvent } from "vitest/browser";
import { formatAccessibilityViolations } from "@/test/accessibility-rules";
import {
  findAccessibilityViolations,
  openConversionScreen,
  openPopupScreen,
  saveReviewScreenshot,
} from "@/test/integration/browser-harness";

const SETTINGS_ROUTES = [
  ["外観", "display"],
  ["通貨変換設定", "symbols"],
  ["対応通貨一覧", "currencies"],
] as const;

it.each(["light", "dark"] as const)(
  "keeps %s popup routes free of automatically detectable violations",
  async (theme) => {
    const failures: string[] = [];

    await openPopupScreen({ theme });
    await collectViolations(failures, "popup converter", "#root");
    await saveReviewScreenshot(`popup-${theme}-converter`);

    await userEvent.click(page.getByRole("button", { name: "換算後を編集" }));
    await expect
      .element(page.getByRole("button", { name: "換算後の編集を終了" }))
      .toBeVisible();
    await collectViolations(failures, "popup target editor", "#root");
    await saveReviewScreenshot(`popup-${theme}-target-editor`);

    await userEvent.click(page.getByRole("combobox", { name: "換算通貨を追加" }));
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await collectViolations(failures, "popup with target picker", "#root");
    await collectViolations(
      failures,
      "popup target picker",
      '[data-slot="popover-content"]',
    );
    await saveReviewScreenshot(`popup-${theme}-target-picker`);

    await openPopupSettings(theme);
    await collectViolations(failures, "popup settings", "#root");
    await saveReviewScreenshot(`popup-${theme}-settings`);

    for (const [routeName, slug] of SETTINGS_ROUTES) {
      // Each route is opened from a fresh popup, so scans must remain sequential.
      /* eslint-disable no-await-in-loop */
      await openPopupSettings(theme);
      await userEvent.click(page.getByRole("button", { name: routeName }));
      await expect.element(page.getByRole("heading", { name: routeName })).toBeVisible();
      await collectViolations(failures, `popup ${routeName}`, "#root");
      await saveReviewScreenshot(`popup-${theme}-settings-${slug}`);
      /* eslint-enable no-await-in-loop */
    }

    expect(failures.length, failures.join("\n\n")).toBe(0);
  },
);

it.each(["success", "loading", "empty", "error"] as const)(
  "keeps the %s conversion card free of automatically detectable violations",
  async (state) => {
    const failures: string[] = [];
    await openConversionScreen({ state });
    await expect.element(page.getByRole("dialog", { name: "換算結果" })).toBeVisible();

    await collectViolations(
      failures,
      `conversion card ${state}`,
      '[data-slot="conversion-host"]',
    );
    await saveReviewScreenshot(`conversion-${state}`);

    expect(failures.length, failures.join("\n\n")).toBe(0);
  },
);

it("keeps the conversion card in Shadow DOM free of automatically detectable violations", async () => {
  const failures: string[] = [];
  await openConversionScreen({ root: "shadow" });
  await expect.element(page.getByRole("dialog", { name: "換算結果" })).toBeVisible();

  await collectViolations(failures, "conversion card in Shadow DOM", {
    fromShadowDom: ["#root", '[data-slot="conversion-host"]'],
  });
  await saveReviewScreenshot("conversion-shadow-dom");

  expect(failures.length, failures.join("\n\n")).toBe(0);
});

/** Runs and labels one state check so all failures in a test are reported together. */
async function collectViolations(
  failures: string[],
  stateName: string,
  include: CrossTreeSelector | LabelledShadowDomSelector,
): Promise<void> {
  const violations = await findAccessibilityViolations({ include: [include] });
  if (violations.length > 0) {
    failures.push(`${stateName}\n${formatAccessibilityViolations(violations)}`);
  }
}

/** Opens the settings index from a fresh popup and waits for its route heading. */
async function openPopupSettings(theme: Config["theme"]): Promise<void> {
  await openPopupScreen({ theme });
  await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
  await expect.element(page.getByRole("heading", { name: "設定" })).toBeVisible();
}
