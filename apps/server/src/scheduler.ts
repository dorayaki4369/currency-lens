import { putOxrLatestResponse } from "./bucket";
import { toRateSnapshot, updateHistory } from "./history";
import { fetchLatestRate } from "@cl/oxr";

type SchedulerDependencies = {
  fetchLatestRates: typeof fetchLatestRate;
  putLatestRates: typeof putOxrLatestResponse;
  updateHistory: typeof updateHistory;
  now: () => number;
  log: (message: string, metadata: Record<string, unknown>) => void;
  logError: (message: string, metadata: Record<string, unknown>) => void;
};

const defaultDependencies: SchedulerDependencies = {
  fetchLatestRates: fetchLatestRate,
  putLatestRates: putOxrLatestResponse,
  updateHistory,
  now: () => Date.now(),
  log: (message, metadata) => console.log(message, metadata),
  logError: (message, metadata) => console.error(message, metadata),
};

/** Creates the hourly refresh handler with testable network and storage boundaries. */
export function createScheduledHandler(
  dependencies: SchedulerDependencies = defaultDependencies,
): ExportedHandlerScheduledHandler<CloudflareBindings> {
  return async (_, env) => {
    const data = await dependencies.fetchLatestRates({
      baseUrl: env.OPEN_EXCHANGE_RATE_API_URL,
      appId: env.OPEN_EXCHANGE_RATE_APP_ID,
    });

    const object = await dependencies.putLatestRates(data, env);
    dependencies.log("Stored latest exchange rates", {
      key: object.key,
      size: object.size,
      base: data.base,
      sourceTimestamp: data.timestamp,
      currencyCount: Object.keys(data.rates).length,
    });

    // The rate history is derived data; failing to update it must not fail the latest-rate refresh.
    try {
      await dependencies.updateHistory(
        env.DATA_BUCKET,
        toRateSnapshot(data),
        dependencies.now(),
      );
    } catch (error) {
      dependencies.logError("Failed to update the exchange rate history", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };
}

export const scheduledHandler = createScheduledHandler();
