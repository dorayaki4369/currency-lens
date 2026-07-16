import { putOxrLatestResponse } from "./bucket";
import { fetchLatestRate } from "@cl/oxr";

type SchedulerDependencies = {
  fetchLatestRates: typeof fetchLatestRate;
  putLatestRates: typeof putOxrLatestResponse;
  log: (message: string, metadata: Record<string, unknown>) => void;
};

const defaultDependencies: SchedulerDependencies = {
  fetchLatestRates: fetchLatestRate,
  putLatestRates: putOxrLatestResponse,
  log: (message, metadata) => console.log(message, metadata),
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
  };
}

export const scheduledHandler = createScheduledHandler();
