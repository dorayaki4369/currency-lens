import type { BrowserContext } from "@playwright/test";
import { rateHistoryQuerySchema, type RateHistory } from "@/lib/rate-history";
import { UPSTREAM_RATES } from "@/test/e2e/global-setup";
import { createRandomWalk } from "@/test/random-walk";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const SLOTS = { daily: 366, hourly: 121 } as const;
const SLOT_MS = { daily: DAY_MS, hourly: HOUR_MS } as const;
const VOLATILITY = { daily: 0.0015, hourly: 0.0004 } as const;

/**
 * Answers the extension's history requests with a deterministic walk that ends at each
 * currency's latest E2E rate. The local Worker starts with no history, so the store images
 * would otherwise show no charts.
 */
export async function serveRateHistory(context: BrowserContext): Promise<void> {
  // Registered after the fixture's forwarding route, so it answers history requests first.
  await context.route(
    (url) => url.pathname === "/v1/history",
    async (route) => {
      const parameters = new URL(route.request().url()).searchParams;
      const query = rateHistoryQuerySchema.parse({
        resolution: parameters.get("resolution"),
        symbols: parameters.get("symbols")?.split(","),
      });
      await route.fulfill({ json: createHistory(query.resolution, query.symbols) });
    },
  );
}

function createHistory(
  resolution: RateHistory["resolution"],
  symbols: readonly string[],
): RateHistory {
  const slotMs = SLOT_MS[resolution];
  const length = SLOTS[resolution];
  return {
    base: "USD",
    rates: Object.fromEntries(
      symbols.map((code) => [
        code,
        createRandomWalk(latestRate(code), length, VOLATILITY[resolution], seedOf(code)),
      ]),
    ),
    resolution,
    start: new Date(
      Math.floor(Date.now() / slotMs) * slotMs - (length - 1) * slotMs,
    ).toISOString(),
  };
}

function latestRate(code: string): number {
  const rate = Object.entries(UPSTREAM_RATES).find(([upstream]) => upstream === code)?.[1];
  if (rate === undefined) throw new Error(`The E2E rates have no ${code}.`);
  return rate;
}

/** Gives each currency its own, stable walk. */
function seedOf(code: string): number {
  let seed = 7;
  for (let index = 0; index < code.length; index += 1) {
    seed = seed * 31 + code.charCodeAt(index);
  }
  return seed;
}
