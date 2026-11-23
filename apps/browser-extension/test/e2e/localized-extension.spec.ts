import type { Locator, Page } from "@playwright/test";
import { SUPPORTED_UI_LOCALES, translate, type UiLocale } from "@/lib/i18n";
import {
  expect,
  expectRateChartDrawn,
  expectTrendLinesDrawn,
  HOST_PAGE_URL,
  saveReviewScreenshot,
  saveScaledReviewScreenshot,
  saveZoomedReviewScreenshot,
  test,
} from "@/test/e2e/fixtures";

/**
 * The currency each locale's store images convert into first. English keeps the euro, because
 * the US dollar is already the source currency of the example price.
 */
const LOCAL_CURRENCIES: Readonly<Record<UiLocale, string>> = {
  de: "EUR",
  en: "EUR",
  es: "EUR",
  fr: "EUR",
  ja: "JPY",
  ko: "KRW",
  "pt-BR": "BRL",
  "zh-CN": "CNY",
  "zh-TW": "TWD",
};

/** A browser language that each shipped UI locale is chosen for. */
const BROWSER_LANGUAGES: Readonly<Record<UiLocale, string>> = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  ja: "ja-JP",
  ko: "ko-KR",
  "pt-BR": "pt-BR",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
};

// Each locale needs its own browser, and the review screenshots feed the localized store images.
for (const locale of SUPPORTED_UI_LOCALES) {
  test.describe(`with the browser language ${BROWSER_LANGUAGES[locale]}`, () => {
    test.use({ locale: BROWSER_LANGUAGES[locale] });

    test(`the built extension speaks ${locale}`, async ({ context, extensionId, page }) => {
      const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(popup.locator("html")).toHaveAttribute("lang", locale);
      await expect(
        popup.getByRole("spinbutton", { exact: true, name: t("sourceAmount") }),
      ).toBeFocused();

      await popup.getByRole("button", { exact: true, name: t("editTargets") }).click();
      const targets = [
        LOCAL_CURRENCIES[locale],
        ...["EUR", "JPY", "GBP"].filter((code) => code !== LOCAL_CURRENCIES[locale]),
      ].slice(0, 3);
      for (const currencyCode of targets) {
        // The editor adds one target at a time, so the additions stay sequential.
        // eslint-disable-next-line no-await-in-loop
        await addConversionTarget(popup, locale, currencyCode);
      }
      // The default USD target repeats the source currency, so the store images leave it out.
      await popup
        .getByRole("button", {
          exact: true,
          name: translate(locale, "removeCurrency", { currency: "USD" }),
        })
        .click();
      await popup
        .getByRole("button", { exact: true, name: t("finishTargetEditing") })
        .click();
      await expect(
        popup.getByRole("button", { exact: true, name: t("editTargets") }),
      ).toBeVisible();
      await popup.mouse.move(0, 0);
      await expect(popup.getByRole("tooltip")).toHaveCount(0);
      // The store images show each target's trend drawn from the seeded history.
      await expectTrendLinesDrawn(popup.locator("body"), 3);
      await waitForSettledAmounts(popup.locator("body"));
      await saveReviewScreenshot(popup, `e2e-${locale}-popup`);

      // The store image shows the rates chart larger than the popup draws it.
      await popup.getByRole("radio", { exact: true, name: t("screenRates") }).click();
      await expect(
        popup.getByText(translate(locale, "ratesAllCaption", { base: "USD" })),
      ).toBeVisible();
      const rateCard = popup
        .getByRole("region", { exact: true, name: t("ratesHeading") })
        .locator('[data-slot="rate-card"]');
      await expectRateChartDrawn(rateCard);
      await waitForSettledAmounts(rateCard);
      await saveZoomedReviewScreenshot(popup, rateCard, `e2e-${locale}-rate-chart`, {
        margin: 8,
        zoom: 2,
      });

      await page.goto(HOST_PAGE_URL, { waitUntil: "domcontentloaded" });
      await page.locator("#price").selectText();
      // The trigger reads out the first conversion in the UI language before it is opened.
      const trigger = page.getByRole("button", { name: quickConversionName(locale) });
      await expect(trigger).toBeVisible();
      // The store image shows the small trigger large, with room for its shadow.
      await saveScaledReviewScreenshot(page, trigger, `e2e-${locale}-quick-conversion`, {
        margin: 16,
        scale: 3,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", { exact: true, name: t("conversionResult") });
      await expect(dialog).toHaveAttribute("lang", locale);
      await expect(
        dialog.getByRole("heading", { exact: true, name: t("convertedHeading") }),
      ).toBeVisible();
      await expectTrendLinesDrawn(dialog, 3);
      await waitForSettledAmounts(dialog);
      await saveReviewScreenshot(page, `e2e-${locale}-conversion-card`);
    });
  });
}

/** Adds one conversion target through the popup editor in the given UI language. */
async function addConversionTarget(
  popup: Page,
  locale: UiLocale,
  currencyCode: string,
): Promise<void> {
  await popup
    .getByRole("combobox", { exact: true, name: translate(locale, "addTarget") })
    .click();
  await popup
    .getByPlaceholder(translate(locale, "currencySearchPlaceholder"))
    .fill(currencyCode);
  await popup.getByRole("option", { name: new RegExp(`^${currencyCode}\\b`, "u") }).click();
  await expect(popup.getByRole("listbox")).toHaveCount(0);
}

/** Matches the trigger's quick-conversion label in one locale, whatever amount it shows. */
function quickConversionName(locale: UiLocale): RegExp {
  const template = translate(locale, "quickConversion", {
    amount: "\u0000",
    currency: "\u0000",
  });
  const pattern = template
    .split("\u0000")
    .map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join(".+");
  return new RegExp(`^${pattern}$`, "u");
}

/** Waits until rolling amounts finish, so the store images never crop a half-rolled digit. */
async function waitForSettledAmounts(scope: Locator): Promise<void> {
  // Rolling digits are CSS animations, including the first roll on mount, so wait for every
  // finite animation in the scope; an endless one such as a spinner would never finish.
  await scope.evaluate(async (element) => {
    const animations = element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(animations.map((animation) => animation.finished));
  });
}
