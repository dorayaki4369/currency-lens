import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchLatestRate } from "@cl/oxr";
import { scheduledHandler } from "./scheduler";
import { getLatestOxrResponse, putOxrLatestResponse } from "./bucket";

type LatestRatesDependencies = {
  getLatestRates: typeof getLatestOxrResponse;
  fetchLatestRates: typeof fetchLatestRate;
  putLatestRates: typeof putOxrLatestResponse;
  logError: (message: string, metadata: Record<string, unknown>) => void;
};
type LatestRates = NonNullable<Awaited<ReturnType<typeof getLatestOxrResponse>>>;

const defaultDependencies: LatestRatesDependencies = {
  getLatestRates: getLatestOxrResponse,
  fetchLatestRates: fetchLatestRate,
  putLatestRates: putOxrLatestResponse,
  logError: (message, metadata) => console.error(message, metadata),
};

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

  /** Coalesces concurrent first requests into one upstream fetch and R2 seed. */
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

  app.get("/latest", async (c) => {
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
  });

  return app;
}

export const app = createApp();

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
