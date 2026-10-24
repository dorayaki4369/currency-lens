import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  chromium,
  test as base,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import { z } from "zod";
import { getHeadlessChromiumLaunchArguments } from "@/test/chromium-launch";
import { E2E_WORKER_URL } from "@/test/e2e/global-setup";

const extensionPath = fileURLToPath(new URL("../../.output/chrome-mv3", import.meta.url));
const manifestPath = fileURLToPath(
  new URL("../../.output/chrome-mv3/manifest.json", import.meta.url),
);
const hostPagePath = fileURLToPath(new URL("extension-host.html", import.meta.url));
const reviewScreenshotDirectory = fileURLToPath(
  new URL("../__screenshots__/review/", import.meta.url),
);
const builtManifestSchema = z.object({
  host_permissions: z.tuple([z.string()]),
});

/** A reserved-TLD page that the browser context answers locally, so no server is started. */
export const HOST_PAGE_URL = "https://host.currency-lens.test/extension-host.html";

interface ExtensionFixtures {
  readonly apiRequests: string[];
  readonly context: BrowserContext;
  readonly extensionId: string;
}

/** Loads the built Manifest V3 extension into one isolated persistent context per test. */
export const test = base.extend<ExtensionFixtures>({
  // Playwright reads fixture dependencies from this binding, and the list needs none.
  // eslint-disable-next-line no-empty-pattern
  apiRequests: async ({}, use) => {
    await use([]);
  },
  context: async ({ apiRequests }, use) => {
    const apiOrigin = await readBuiltApiOrigin();
    const context = await chromium.launchPersistentContext("", {
      args: [
        ...getHeadlessChromiumLaunchArguments(),
        // Requests that escape forwarding fail instead of reaching the production API.
        `--host-resolver-rules=MAP ${new URL(apiOrigin).hostname} ~NOTFOUND`,
        // Reserve enough screen space below the toolbar for a 37.5rem-tall popup.
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
    await context.route(`${apiOrigin}/**`, (route) => forwardToWorker(route, apiRequests));
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

/** Reads the API origin from the built manifest, so tests follow the endpoint the build embedded. */
async function readBuiltApiOrigin(): Promise<string> {
  const manifest = builtManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  return new URL(manifest.host_permissions[0].replace(/\*$/u, "")).origin;
}

/** Forwards an API request to the local Worker and relays its response unchanged. */
async function forwardToWorker(route: Route, apiRequests: string[]): Promise<void> {
  const url = new URL(route.request().url());
  apiRequests.push(url.pathname);
  const response = await route.fetch({
    url: `${E2E_WORKER_URL}${url.pathname}${url.search}`,
  });
  await route.fulfill({ response });
}

export { expect } from "@playwright/test";
