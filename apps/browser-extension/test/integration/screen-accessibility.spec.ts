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

it.each(["light", "dark"] as const)(
  "keeps the %s rates screen free of automatically detectable violations",
  async (theme) => {
    const failures: string[] = [];

    await openPopupScreen({ theme });
    await userEvent.click(page.getByRole("button", { name: "レート", exact: true }));
    await expect
      .element(page.getByRole("slider", { name: "対 USD の変化率のチャート（過去1か月）" }))
      .toBeVisible();
    await collectViolations(failures, "popup rates for all targets", "#root");
    await saveReviewScreenshot(`popup-${theme}-rates-all`);

    await userEvent.click(page.getByRole("button", { name: "JPY", exact: true }));
    const chart = page.getByRole("slider", {
      name: "USD に対する JPY のチャート（過去1か月）",
    });
    await expect.element(chart).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "1年", exact: true }));
    await expect
      .element(page.getByRole("slider", { name: "USD に対する JPY のチャート（過去1年）" }))
      .toBeVisible();
    await collectViolations(failures, "popup rates for one target", "#root");
    await saveReviewScreenshot(`popup-${theme}-rates-single`);

    expect(failures.length, failures.join("\n\n")).toBe(0);
  },
);

it.each(["light", "dark"] as const)(
  "keeps the %s chart color picker and a light custom color free of violations",
  async (theme) => {
    const failures: string[] = [];

    await openPopupSettings(theme);
    await userEvent.click(page.getByRole("button", { name: "外観" }));
    await userEvent.click(page.getByRole("button", { name: "上昇の色を変える" }));
    const picker = page.getByRole("dialog", { name: "上昇の色" });
    await expect.element(picker).toBeVisible();
    await collectViolations(failures, "popup chart color picker", "#root");
    await collectViolations(
      failures,
      "chart color picker",
      '[data-slot="trend-color-picker"]',
    );
    await saveReviewScreenshot(`popup-${theme}-chart-color-picker`);

    // Yellow is the lightest swatch, so it checks that no text depends on the chosen color.
    await userEvent.click(picker.getByRole("button", { name: "黄", exact: true }));
    await expect.element(picker).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "上昇の色を変える" }))
      .toHaveFocus();
    await saveReviewScreenshot(`popup-${theme}-chart-colors-custom`);
    await userEvent.click(page.getByRole("button", { name: "戻る" }));
    await userEvent.click(page.getByRole("button", { name: "戻る" }));
    await userEvent.click(page.getByRole("button", { name: "レート", exact: true }));
    await expect.element(page.getByRole("heading", { name: "基準" })).toBeVisible();
    await collectViolations(failures, "popup rates with a custom rise color", "#root");
    await saveReviewScreenshot(`popup-${theme}-rates-custom-color`);
    await userEvent.click(page.getByRole("button", { name: "EUR", exact: true }));
    await expect.element(page.getByRole("slider")).toBeVisible();
    await collectViolations(failures, "popup rate with a custom rise color", "#root");
    await saveReviewScreenshot(`popup-${theme}-rate-custom-color`);

    expect(failures.length, failures.join("\n\n")).toBe(0);
  },
);

it.each(["loading", "empty", "error"] as const)(
  "explains the %s rate history state without automatically detectable violations",
  async (history) => {
    const failures: string[] = [];
    const messages = {
      empty: "レートの履歴はまだありません。",
      error: "レートの履歴を取得できませんでした。",
      loading: "レートの履歴を読み込み中",
    } as const;

    await openPopupScreen({ history });
    await userEvent.click(page.getByRole("button", { name: "レート", exact: true }));
    await expect
      .element(
        history === "loading"
          ? page.getByRole("status", { name: messages.loading })
          : page.getByText(new RegExp(`^${messages[history]}`, "u")),
      )
      .toBeVisible();
    await collectViolations(failures, `popup rates ${history}`, "#root");
    await saveReviewScreenshot(`popup-rates-${history}`);

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
