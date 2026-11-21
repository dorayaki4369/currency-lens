import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { fetchLatestRate } from "@cl/oxr";
import { scheduledHandler } from "./scheduler";
import { getLatestOxrResponse, putOxrLatestResponse } from "./bucket";
import { historyQuerySchema, readHistory } from "./history";

type LatestRatesDependencies = {
  getLatestRates: typeof getLatestOxrResponse;
  fetchLatestRates: typeof fetchLatestRate;
  putLatestRates: typeof putOxrLatestResponse;
  readHistory: typeof readHistory;
  getResponseCache: () => Cache | undefined;
  now: () => number;
  logError: (message: string, metadata: Record<string, unknown>) => void;
};
type LatestRates = NonNullable<Awaited<ReturnType<typeof getLatestOxrResponse>>>;

const defaultDependencies: LatestRatesDependencies = {
  getLatestRates: getLatestOxrResponse,
  fetchLatestRates: fetchLatestRate,
  putLatestRates: putOxrLatestResponse,
  readHistory,
  getResponseCache: () => (typeof caches === "undefined" ? undefined : caches.default),
  now: () => Date.now(),
  logError: (message, metadata) => console.error(message, metadata),
};

/** History responses change at most hourly, so edge copies may be reused briefly. */
const HISTORY_CACHE_CONTROL = "public, max-age=300";

/** Returns whether a browser origin is allowed to read the public rates API. */
function allowExtensionOrigin(origin: string): string {
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
    return origin;
  }

  return "";
}

/** Converts an internal failure to metadata that is safe to emit in Worker logs. */
function toErrorMetadata(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: "UnknownError" };
}

/**
 * Creates the Worker HTTP application with replaceable external boundaries for
 * deterministic tests.
 */
export function createApp(dependencies: LatestRatesDependencies = defaultDependencies) {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  let seedPromise: Promise<LatestRates> | undefined;

  /** Coalesces concurrent requests for an empty bucket into one upstream fetch. */
  function seedLatestRates(env: CloudflareBindings, appId: string): Promise<LatestRates> {
    if (!seedPromise) {
      seedPromise = (async () => {
        const seededData = await dependencies.fetchLatestRates({
          baseUrl: env.OPEN_EXCHANGE_RATE_API_URL,
          appId,
        });
        await dependencies.putLatestRates(seededData, env);
        return seededData;
      })().finally(() => {
        seedPromise = undefined;
      });
    }

    return seedPromise;
  }

  app.use(
    "*",
    cors({
      origin: allowExtensionOrigin,
      allowMethods: ["GET"],
    }),
  );

  /** Serves the stable v1 contract on both its versioned and legacy routes. */
  const serveLatestRates = async (c: Context<{ Bindings: CloudflareBindings }>) => {
    let data: Awaited<ReturnType<typeof getLatestOxrResponse>>;

    try {
      data = await dependencies.getLatestRates(c.env);
    } catch (error) {
      dependencies.logError(
        "Failed to read the latest exchange rates from R2",
        toErrorMetadata(error),
      );
      return c.json({ error: "Rates not available" }, 503);
    }

    if (!data) {
      const appId = c.env.OPEN_EXCHANGE_RATE_APP_ID?.trim();
      if (!appId) {
        return c.json({ error: "Rates not available" }, 503);
      }

      try {
        data = await seedLatestRates(c.env, appId);
      } catch (error) {
        dependencies.logError(
          "Failed to seed the latest exchange rates",
          toErrorMetadata(error),
        );
        return c.json({ error: "Rates not available" }, 503);
      }
    }

    return c.json({
      rates: data.rates,
      timestamp: data.timestamp,
      base: data.base,
    });
  };

  app.get("/v1/latest", serveLatestRates);
  app.get("/latest", serveLatestRates);

  /** Serves aligned USD-based rate series for up to six currencies. */
  app.get("/v1/history", async (c) => {
    const query = historyQuerySchema.safeParse({
      resolution: c.req.query("resolution"),
      symbols: c.req.query("symbols"),
    });
    if (!query.success) {
      return c.json({ error: "Invalid history query" }, 400);
    }

    // The edge cache only saves work; its failures must not change the response.
    const cache = dependencies.getResponseCache();
    const cacheUrl = new URL(c.req.url);
    cacheUrl.search = new URLSearchParams({
      resolution: query.data.resolution,
      symbols: query.data.symbols.toSorted().join(","),
    }).toString();
    const cacheKey = new Request(cacheUrl);
    try {
      const cached = await cache?.match(cacheKey);
      if (cached) {
        return c.body(await cached.text(), 200, { "Content-Type": "application/json" });
      }
    } catch (error) {
      dependencies.logError(
        "Failed to read the history response cache",
        toErrorMetadata(error),
      );
    }

    let body: string;
    try {
      body = JSON.stringify(
        await dependencies.readHistory(c.env.DATA_BUCKET, query.data, dependencies.now()),
      );
    } catch (error) {
      dependencies.logError(
        "Failed to read the exchange rate history from R2",
        toErrorMetadata(error),
      );
      return c.json({ error: "History not available" }, 503);
    }

    try {
      await cache?.put(
        cacheKey,
        new Response(body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": HISTORY_CACHE_CONTROL,
          },
        }),
      );
    } catch (error) {
      dependencies.logError(
        "Failed to store the history response cache",
        toErrorMetadata(error),
      );
    }
    return c.body(body, 200, { "Content-Type": "application/json" });
  });

  return app;
}

export const app = createApp();

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
