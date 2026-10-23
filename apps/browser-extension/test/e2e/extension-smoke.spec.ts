import type { BrowserContext, Locator } from "@playwright/test";
import type { Config } from "@/lib/currency";
import type { ExchangeRateCache } from "@/lib/rates";
import { expectNoAutomatedAccessibilityViolations } from "@/test/accessibility";
import { expect, HOST_PAGE_URL, saveReviewScreenshot, test } from "@/test/e2e/fixtures";

const localized = {
  amount: /^(?:Amount|金額)$/u,
  conversionResult: /^(?:Conversion result|換算結果)$/u,
  convertSelection: /^(?:Convert selected price|選択した金額を換算)$/u,
  converted: /^(?:Converted|換算後)$/u,
} as const;

interface ChromeStorageArea {
  set(items: Readonly<Record<string, unknown>>): Promise<void>;
}

interface ChromeExtensionGlobal {
  readonly chrome: {
    readonly action: {
      openPopup(): Promise<void>;
    };
    readonly extension: {
      getViews(properties: { readonly type: "popup" }): Window[];
    };
    readonly storage: {
      readonly local: ChromeStorageArea;
      readonly sync: ChromeStorageArea;
    };
  };
}

test.beforeEach(async ({ context, extensionId }) => {
  await seedExtensionState(context, extensionId);
});

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

test("the built extension exposes an accessible popup and content flow", async ({
  context,
  extensionId,
  page,
}, testInfo) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole("heading", { name: "Currency Lens" })).toBeVisible();
  await expectAppLogoLoaded(popup.locator('[data-slot="app-logo"]'));
  await expect(popup.getByRole("spinbutton", { name: localized.amount })).toBeFocused();
  await expect(popup.getByText("149.00", { exact: true })).toBeVisible();
  await saveReviewScreenshot(popup, "e2e-popup");

  await expectNoAutomatedAccessibilityViolations(popup, testInfo, {
    attachmentName: "axe-results-built-popup",
  });

  await page.goto(HOST_PAGE_URL, { waitUntil: "domcontentloaded" });
  await page.locator("#price").selectText();

  const trigger = page.getByRole("button", { name: localized.convertSelection });
  await expect(trigger).toBeVisible();
  await expectAppLogoLoaded(trigger.locator('[data-slot="app-logo"]'));
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

/** Verifies bundled artwork actually decodes in popup and host-page execution contexts. */
async function expectAppLogoLoaded(logo: Locator): Promise<void> {
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", /^data:image\/svg\+xml[;,]/u);
  await expect
    .poll(() =>
      logo.evaluate(
        (element) =>
          element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0,
      ),
    )
    .toBe(true);
}

/** Seeds validated config and rates so E2E rendering never depends on an external API. */
async function seedExtensionState(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  const storagePage = await context.newPage();
  await storagePage.goto(`chrome-extension://${extensionId}/popup.html`);
  await storagePage.evaluate(async (state) => {
    const extensionGlobal = globalThis as typeof globalThis & ChromeExtensionGlobal;
    await extensionGlobal.chrome.storage.sync.set({ config: state.config });
    await extensionGlobal.chrome.storage.local.set({
      exchangeRateCache: state.rateCache,
    });
  }, createExtensionState());
  await storagePage.close();
}

/** Creates a recent, schema-valid state for deterministic popup and content conversion. */
function createExtensionState(): {
  readonly config: Config;
  readonly rateCache: ExchangeRateCache;
} {
  const now = Date.now();
  return {
    config: {
      favorites: ["JPY", "EUR", "GBP"],
      symbolOverrides: { $: "USD" },
      theme: "light",
    },
    rateCache: {
      base: "USD",
      fetchedAt: now,
      rates: {
        EUR: "0.8621",
        GBP: "0.7428",
        JPY: "149.45",
        USD: "1",
      },
      sourceTimestamp: now,
    },
  };
}
