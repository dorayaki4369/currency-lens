import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, test as base, type BrowserContext, type Page } from "@playwright/test";
import { getHeadlessChromiumLaunchArguments } from "@/test/chromium-launch";

const extensionPath = fileURLToPath(new URL("../../.output/chrome-mv3", import.meta.url));
const hostPagePath = fileURLToPath(new URL("extension-host.html", import.meta.url));
const reviewScreenshotDirectory = fileURLToPath(
  new URL("../__screenshots__/review/", import.meta.url),
);

/** A reserved-TLD page that the browser context answers locally, so no server is started. */
export const HOST_PAGE_URL = "https://host.currency-lens.test/extension-host.html";

interface ExtensionFixtures {
  readonly context: BrowserContext;
  readonly extensionId: string;
}

/** Loads the built Manifest V3 extension into one isolated persistent context per test. */
export const test = base.extend<ExtensionFixtures>({
  // Playwright reads fixture dependencies from this binding, and the context needs none.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      args: [
        ...getHeadlessChromiumLaunchArguments(),
        // Reserve enough screen space below the toolbar for a 600px-tall popup.
        "--screen-info={1280x900}",
        "--window-size=1280,900",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      channel: "chromium",
      headless: true,
      locale: "ja-JP",
      viewport: null,
    });
    const hostPage = await readFile(hostPagePath, "utf8");
    await context.route(HOST_PAGE_URL, (route) =>
      route.fulfill({ body: hostPage, contentType: "text/html; charset=utf-8" }),
    );

    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const existingWorker = context.serviceWorkers()[0];
    const serviceWorker = existingWorker ?? (await context.waitForEvent("serviceworker"));
    await use(new URL(serviceWorker.url()).host);
  },
});

/** Saves the page as an uncompared image for manual design review, beside integration images. */
export async function saveReviewScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${reviewScreenshotDirectory}${name}.png` });
}

export { expect } from "@playwright/test";
