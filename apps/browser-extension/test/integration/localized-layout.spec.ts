import { beforeEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SUPPORTED_UI_LOCALES, translate, type UiLocale } from "@/lib/i18n";
import {
  emulateMedia,
  openConversionScreen,
  openPopupScreen,
  requireElement,
  saveReviewScreenshot,
  setViewport,
} from "@/test/integration/browser-harness";

const SETTINGS_ROUTES = [
  ["displayHeading", "display"],
  ["ambiguousHeading", "symbols"],
  ["supportedCurrenciesHeading", "currencies"],
  ["aboutHeading", "about"],
] as const;

beforeEach(async () => {
  await setViewport({ height: 600, width: 420 });
  await emulateMedia({ reducedMotion: "reduce" });
});

it.each(SUPPORTED_UI_LOCALES)(
  "keeps every %s popup screen inside the popup",
  async (locale) => {
    const failures: string[] = [];
    const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

    await openPopupScreen({ locale });
    collectOverflow(failures, locale, "converter");
    await saveReviewScreenshot(`locale-${locale}-popup-converter`);

    await userEvent.click(
      page.getByRole("button", { exact: true, name: t("editTargets") }),
    );
    await expect
      .element(page.getByRole("button", { exact: true, name: t("finishTargetEditing") }))
      .toBeVisible();
    collectOverflow(failures, locale, "target editor");
    await saveReviewScreenshot(`locale-${locale}-popup-target-editor`);

    await userEvent.click(
      page.getByRole("combobox", { exact: true, name: t("addTarget") }),
    );
    await expect.element(page.getByRole("listbox")).toBeVisible();
    collectOverflow(failures, locale, "target picker");
    await saveReviewScreenshot(`locale-${locale}-popup-target-picker`);

    for (const [headingKey, slug] of SETTINGS_ROUTES) {
      // Each route is opened from a fresh popup, so checks must remain sequential.
      /* eslint-disable no-await-in-loop */
      await openSettings(locale);
      await userEvent.click(page.getByRole("button", { exact: true, name: t(headingKey) }));
      await expect
        .element(page.getByRole("heading", { exact: true, name: t(headingKey) }))
        .toBeVisible();
      collectOverflow(failures, locale, `settings ${slug}`);
      await saveReviewScreenshot(`locale-${locale}-popup-settings-${slug}`);
      /* eslint-enable no-await-in-loop */
    }

    // The about route stays open from the loop, and the licenses list is reached from it.
    await userEvent.click(
      page.getByRole("button", { exact: true, name: t("licensesHeading") }),
    );
    await expect
      .element(page.getByRole("heading", { exact: true, name: t("licensesHeading") }))
      .toBeVisible();
    collectOverflow(failures, locale, "settings licenses");
    await saveReviewScreenshot(`locale-${locale}-popup-settings-licenses`);

    expect(failures, failures.join("\n")).toEqual([]);
  },
);

it.each(SUPPORTED_UI_LOCALES)(
  "keeps every %s conversion card state inside the card",
  async (locale) => {
    const failures: string[] = [];
    for (const state of ["success", "empty", "error"] as const) {
      // The screens replace each other, so they must be checked one at a time.
      /* eslint-disable no-await-in-loop */
      await setViewport();
      await openConversionScreen({ locale, state });
      const dialog = page.getByRole("dialog", {
        exact: true,
        name: translate(locale, "conversionResult"),
      });
      await expect.element(dialog).toBeVisible();
      await expect.element(dialog).toHaveAttribute("lang", locale);
      collectOverflow(failures, locale, `conversion ${state}`, "dialog");
      await saveReviewScreenshot(`locale-${locale}-conversion-${state}`);
      /* eslint-enable no-await-in-loop */
    }

    expect(failures, failures.join("\n")).toEqual([]);
  },
);

// The picker opens below the editor at the browser-mode default viewport, and the store images
// crop this screenshot at the size the original Japanese source screenshot was taken at.
it.each(SUPPORTED_UI_LOCALES)(
  "keeps every %s target picker option readable below the editor for the store images",
  async (locale) => {
    const failures: string[] = [];
    await setViewport({ height: 896, width: 414 });
    await openPopupScreen({ locale });
    await userEvent.click(
      page.getByRole("button", { exact: true, name: translate(locale, "editTargets") }),
    );
    await userEvent.click(
      page.getByRole("combobox", { exact: true, name: translate(locale, "addTarget") }),
    );
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await expect
      .element(page.getByPlaceholder(translate(locale, "currencySearchPlaceholder")))
      .toBeVisible();
    collectOverflow(
      failures,
      locale,
      "store target picker",
      '[data-slot="popover-content"]',
    );
    await saveReviewScreenshot(`store-${locale}-target-picker`);

    expect(failures, failures.join("\n")).toEqual([]);
  },
);

/** Opens the settings index from a fresh popup and waits for its route heading. */
async function openSettings(locale: UiLocale): Promise<void> {
  await openPopupScreen({ locale });
  await userEvent.click(
    page.getByRole("button", { exact: true, name: translate(locale, "openSettings") }),
  );
  await expect
    .element(
      page.getByRole("heading", {
        exact: true,
        name: translate(locale, "settingsHeading"),
      }),
    )
    .toBeVisible();
}

/** Records visible text cut off sideways by the container or a clipping ancestor; vertical overflow scrolls. */
function collectOverflow(
  failures: string[],
  locale: UiLocale,
  stateName: string,
  containerSelector = '[data-slot="popup-root"]',
): void {
  const container = requireElement(containerSelector);
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? "";
    const parent = node.parentElement;
    // Decorative marks such as the SDR icon are the same in every locale.
    if (
      text === "" ||
      parent === null ||
      parent.closest('[aria-hidden="true"]') !== null ||
      isVisuallyHidden(parent)
    ) {
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const textBounds = range.getBoundingClientRect();
    const clipper = findClippingBox(parent, container);
    if (clipper.truncatesWithEllipsis) {
      continue;
    }
    if (textBounds.left < clipper.left - 0.5 || textBounds.right > clipper.right + 0.5) {
      failures.push(`${locale} ${stateName}: "${text.slice(0, 60)}"`);
    }
  }
}

/** Screen-reader-only text is clipped on purpose, so it is not a layout failure. */
function isVisuallyHidden(element: Element): boolean {
  for (
    let current: Element | null = element;
    current !== null;
    current = current.parentElement
  ) {
    const bounds = current.getBoundingClientRect();
    if (bounds.width <= 1 || bounds.height <= 1) {
      return true;
    }
  }
  return false;
}

interface ClippingBox {
  readonly left: number;
  readonly right: number;
  /** Long names deliberately end with an ellipsis, so cutting them is the intended layout. */
  readonly truncatesWithEllipsis: boolean;
}

/** Returns the nearest box that hides overflow, or the container itself. */
function findClippingBox(element: Element, container: Element): ClippingBox {
  let current: Element = element;
  while (current !== container && current.parentElement !== null) {
    const style = getComputedStyle(current);
    if (style.overflowX !== "visible") {
      return toClippingBox(current, style.textOverflow === "ellipsis");
    }
    current = current.parentElement;
  }
  return toClippingBox(container, false);
}

/** Keeps only the horizontal edges of a clipping element, which is all the check compares. */
function toClippingBox(element: Element, truncatesWithEllipsis: boolean): ClippingBox {
  const { left, right } = element.getBoundingClientRect();
  return { left, right, truncatesWithEllipsis };
}
