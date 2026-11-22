import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { z } from "zod";
import { settleFiniteAnimations } from "@/test/animation-settle";
import { getHeadlessChromiumLaunchArguments } from "@/test/chromium-launch";
import {
  E2E_WORKER_URL,
  HISTORY_SEED_DATE_VARIABLE,
  toUtcDate,
} from "@/test/e2e/global-setup";

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
  context: async ({ apiRequests, locale }, use) => {
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
      // Playwright's locale also sets the browser UI language that the extension follows.
      locale: locale ?? "ja-JP",
      viewport: null,
    });
    await context.route(`${apiOrigin}/**`, (route) => forwardToWorker(route, apiRequests));
    const hostPage = await readFile(hostPagePath, "utf8");
    await context.route(HOST_PAGE_URL, (route) =>
      route.fulfill({ body: hostPage, contentType: "text/html; charset=utf-8" }),
    );

    await use(context);
    // The extension keeps requesting rates after a short test ends. Closing the context while
    // a forward is in flight disposes the request context under `route.fetch`, so let every
    // forward finish first.
    await context.unrouteAll({ behavior: "wait" });
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
  await page.evaluate(settleFiniteAnimations);
  await page.screenshot({ path: `${reviewScreenshotDirectory}${name}.png` });
}

/**
 * Saves one element rendered at a higher pixel density, for store images that show it larger
 * than its on-page size without upscaling blur.
 */
export async function saveScaledReviewScreenshot(
  page: Page,
  element: Locator,
  name: string,
  { margin, scale }: { readonly margin: number; readonly scale: number },
): Promise<void> {
  await page.evaluate(settleFiniteAnimations);
  const box = await element.boundingBox();
  if (box === null) throw new Error(`${name}: the element is not visible.`);
  const devtools = await page.context().newCDPSession(page);
  try {
    // A transparent page background lets the store image place the element on its own backdrop.
    await devtools.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { a: 0, b: 0, g: 0, r: 0 },
    });
    await page.evaluate(() => {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    });
    const { data } = await devtools.send("Page.captureScreenshot", {
      clip: {
        height: box.height + margin * 2,
        scale,
        width: box.width + margin * 2,
        x: box.x - margin,
        y: box.y - margin,
      },
      format: "png",
    });
    await writeFile(`${reviewScreenshotDirectory}${name}.png`, Buffer.from(data, "base64"));
  } finally {
    await devtools.send("Emulation.setDefaultBackgroundColorOverride", {});
    await page.evaluate(() => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    });
    await devtools.detach();
  }
}

/**
 * Saves one element of an extension page enlarged with CSS zoom, on a transparent background.
 * The DevTools capture ignores the clip position on extension pages, so they are zoomed instead.
 * The page keeps the zoom and the cleared backgrounds afterwards, so call this last on a page.
 */
export async function saveZoomedReviewScreenshot(
  page: Page,
  element: Locator,
  name: string,
  { margin, zoom }: { readonly margin: number; readonly zoom: number },
): Promise<void> {
  await page.evaluate(settleFiniteAnimations);
  // Clears the backgrounds behind the element, so only the element and its shadow remain.
  await element.evaluate((target, scale) => {
    document.documentElement.style.zoom = String(scale);
    for (let node = target.parentElement; node !== null; node = node.parentElement) {
      node.style.setProperty("background", "transparent", "important");
    }
  }, zoom);
  const box = await element.boundingBox();
  if (box === null) throw new Error(`${name}: the element is not visible.`);
  await page.screenshot({
    clip: {
      height: box.height + margin * 2 * zoom,
      width: box.width + margin * 2 * zoom,
      x: box.x - margin * zoom,
      y: box.y - margin * zoom,
    },
    // The zoomed element can reach below the window, which only a full-page capture includes.
    fullPage: true,
    omitBackground: true,
    path: `${reviewScreenshotDirectory}${name}.png`,
  });
}

/** Waits until each target's trend draws a line from the history, not the empty dashed line. */
export async function expectTrendLinesDrawn(scope: Locator, count: number): Promise<void> {
  await expect(scope.locator('[data-slot="sparkline"] path')).toHaveCount(count * 2);
  await expect(scope.locator('[data-slot="sparkline-placeholder"]')).toHaveCount(0);
}

/**
 * Waits until the rate chart draws the seeded history without any span marked as missing data.
 * The Worker takes the newest daily point from an hourly slot of the current UTC date, so after
 * UTC midnight passes during a run, the chart may end in one empty span, as it would in
 * production until the next hourly aggregation.
 */
export async function expectRateChartDrawn(scope: Locator): Promise<void> {
  await expect(scope.locator('[data-slot="rate-chart"]')).toBeVisible();
  const gaps = scope.locator('[data-slot="rate-chart-gap"]');
  const seedDate = process.env[HISTORY_SEED_DATE_VARIABLE];
  expect(seedDate, "global setup records when it seeded the history").toBeDefined();
  if (seedDate === toUtcDate(Date.now())) {
    await expect(gaps).toHaveCount(0);
  } else {
    expect(await gaps.count()).toBeLessThanOrEqual(1);
  }
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

export { expect };
