import type { Locator, Page } from "@playwright/test";
import packageManifest from "@/package.json" with { type: "json" };
import { expectNoAutomatedAccessibilityViolations } from "@/test/accessibility";
import { expect, HOST_PAGE_URL, saveReviewScreenshot, test } from "@/test/e2e/fixtures";

const localized = {
  addTarget: /^(?:Add a target|換算通貨を追加)$/u,
  amount: /^(?:Amount|金額)$/u,
  conversionResult: /^(?:Conversion result|換算結果)$/u,
  quickConversion:
    /^(?:¥37,213 \(Japanese Yen\)\. Show all conversions|￥37,213（日本円）。すべての換算先を表示)$/u,
  converted: /^(?:Converted|換算後)$/u,
  currencySearch: /^(?:Code, name, or region|コード・通貨名・地域)$/u,
  editTargets: /^(?:Edit conversion targets|換算後を編集)$/u,
  finishTargetEditing: /^(?:Finish editing conversion targets|換算後の編集を終了)$/u,
  about: /^(?:About|このアプリについて)$/u,
  licenses: /^(?:Open source licenses|オープンソースライセンス)$/u,
  openSettings: /^(?:Open settings|設定を開く)$/u,
  review: /^(?:Write a review on Chrome Web Store|Chrome ウェブストアでレビューを書く)/u,
} as const;

interface ChromeExtensionGlobal {
  readonly chrome: {
    readonly action: {
      openPopup(): Promise<void>;
    };
    readonly extension: {
      getViews(properties: { readonly type: "popup" }): Window[];
    };
  };
}

test("the toolbar popup opens at its full size", async ({ context, extensionId }) => {
  const controller = await context.newPage();
  await controller.goto(`chrome-extension://${extensionId}/popup.html`);
  await controller.evaluate(async () => {
    const extensionGlobal = globalThis as typeof globalThis & ChromeExtensionGlobal;
    await extensionGlobal.chrome.action.openPopup();
  });

  await expect
    .poll(() =>
      controller.evaluate(() => {
        const extensionGlobal = globalThis as typeof globalThis & ChromeExtensionGlobal;
        const popup = extensionGlobal.chrome.extension.getViews({ type: "popup" })[0];
        return { width: popup?.innerWidth, height: popup?.innerHeight };
      }),
    )
    .toEqual({ width: 400, height: 600 });
});

test("the built popup shows its version, store review link, and bundled licenses", async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole("button", { name: localized.openSettings }).click();
  await popup.getByRole("button", { name: localized.about }).click();

  await expect(
    popup.getByText(new RegExp(`${packageManifest.version}$`, "u")),
  ).toBeVisible();
  await expect(popup.getByRole("link", { name: localized.review })).toHaveAttribute(
    "href",
    "https://chromewebstore.google.com/detail/cfpmgblhfmfomcgkpkghcgkcfblbpgkm/reviews",
  );

  await saveReviewScreenshot(popup, "e2e-popup-about");

  await popup.getByRole("button", { name: localized.licenses }).click();
  const licenses = popup.getByRole("list", { name: localized.licenses });
  await expect(licenses.getByText("react-dom", { exact: true })).toBeVisible();
  await expect(licenses.getByText("tailwindcss", { exact: true })).toBeVisible();
  await licenses.getByText("react-dom", { exact: true }).click();
  await saveReviewScreenshot(popup, "e2e-popup-licenses");
});

test("the built extension exposes an accessible popup and content flow", async ({
  apiRequests,
  context,
  extensionId,
  page,
}, testInfo) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole("heading", { name: "Currency Lens" })).toBeVisible();
  await expectAppLogoLoaded(popup.locator('[data-slot="app-logo"]'));
  await expect(popup.getByRole("spinbutton", { name: localized.amount })).toBeFocused();
  expect(apiRequests).toContain("/v1/latest");

  await popup.getByRole("button", { name: localized.editTargets }).click();
  await addConversionTarget(popup, "JPY");
  await addConversionTarget(popup, "EUR");
  await addConversionTarget(popup, "GBP");
  await finishTargetEditing(popup);
  await expect(popup.getByText("149.00", { exact: true })).toBeVisible();
  await saveReviewScreenshot(popup, "e2e-popup");

  await expectNoAutomatedAccessibilityViolations(popup, testInfo, {
    attachmentName: "axe-results-built-popup",
  });

  await page.goto(HOST_PAGE_URL, { waitUntil: "domcontentloaded" });
  await page.locator("#price").selectText();

  // The first target is USD, the selected currency, so the trigger shows the next target, JPY.
  const trigger = page.getByRole("button", { name: localized.quickConversion });
  await expect(trigger).toBeVisible();
  await expectImageLoaded(trigger.locator('[data-currency-icon="JPY"] img'));
  await saveReviewScreenshot(page, "e2e-selection-trigger");
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: localized.conversionResult });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-slot="app-logo"]')).toHaveCount(0);
  await expect(dialog.getByRole("spinbutton", { name: localized.amount })).toBeFocused();
  await expect(dialog.getByRole("heading", { name: localized.converted })).toBeVisible();
  await expect(dialog.getByText("37,213.00", { exact: true })).toBeVisible();
  await saveReviewScreenshot(page, "e2e-conversion-card");

  await expectNoAutomatedAccessibilityViolations(page, testInfo, {
    attachmentName: "axe-results-built-content-script",
    include: {
      fromShadowDom: ["currency-lens-overlay", "[data-theme]"],
    },
  });
});

/** Adds one conversion target through the popup editor, as a new user would after installing. */
async function addConversionTarget(popup: Page, currencyCode: string): Promise<void> {
  await popup.getByRole("combobox", { name: localized.addTarget }).click();
  await popup.getByPlaceholder(localized.currencySearch).fill(currencyCode);
  await popup.getByRole("option", { name: new RegExp(`^${currencyCode}\\b`, "u") }).click();
  await expect(popup.getByRole("listbox")).toHaveCount(0);
}

/** Leaves the popup editor and returns it to the converter view without overlays. */
async function finishTargetEditing(popup: Page): Promise<void> {
  await popup.getByRole("button", { name: localized.finishTargetEditing }).click();
  await expect(popup.getByRole("button", { name: localized.editTargets })).toBeVisible();
  // The pointer still rests on the editor toggle, so move it away to close its hover tooltip.
  await popup.mouse.move(0, 0);
  await expect(popup.getByRole("tooltip")).toHaveCount(0);
}

/** Verifies bundled artwork actually decodes in popup and host-page execution contexts. */
async function expectAppLogoLoaded(logo: Locator): Promise<void> {
  await expect(logo).toHaveAttribute("src", /^data:image\/svg\+xml[;,]/u);
  await expectImageLoaded(logo);
}

/** Verifies that an image is visible and decoded from its packaged source. */
async function expectImageLoaded(image: Locator): Promise<void> {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (element) =>
          element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0,
      ),
    )
    .toBe(true);
}
