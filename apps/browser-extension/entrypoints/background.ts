import {
  convertCurrenciesResponseSchema,
  getConfigResponseSchema,
  getRatesResponseSchema,
  messageSchema,
  messageTypes,
  parseMessageResponse,
  setConfigResponseSchema,
  type ConvertCurrenciesRequest,
  type Message,
  type MessageResponse,
} from "../lib/messages";
import {
  convertCurrencyBatch,
  fetchExchangeRateCache,
  getRateSnapshot,
  isExchangeRateCacheStale,
} from "../lib/rates";
import { RATE_REFRESH_ALARM_NAME, ensureRateRefreshAlarm } from "../lib/rate-refresh";
import {
  getConfig,
  getExchangeRateCache,
  setConfig,
  setExchangeRateCache,
} from "../lib/storage";

const RATE_ENDPOINT = new URL("v1/latest", `${import.meta.env.API_ENDPOINT}/`).href;
let activeRateRefresh: Promise<void> | null = null;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    respondToRuntimeMessage(message, sendResponse);
    return true;
  });

  browser.runtime.onInstalled.addListener(() => {
    runBackgroundTask(ensureAndRefreshRates(true), "installation rate refresh");
  });

  browser.runtime.onStartup.addListener(() => {
    runBackgroundTask(ensureAndRefreshRates(true), "startup rate refresh");
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RATE_REFRESH_ALARM_NAME) {
      runBackgroundTask(refreshRates(), "scheduled rate refresh");
    }
  });

  runBackgroundTask(ensureAndRefreshRates(false), "background initialization");
});

/** Keeps the Chrome message channel open and completes it after async validation and routing. */
function respondToRuntimeMessage(
  message: unknown,
  sendResponse: (response?: unknown) => unknown,
): void {
  void handleMessage(message)
    .then((response) => {
      return sendResponse(response);
    })
    .catch((error: unknown) => {
      return sendResponse({ success: false, error: getErrorMessage(error) });
    });
}

/** Validates an incoming runtime message and routes it to its owning workflow. */
export async function handleMessage(message: unknown): Promise<MessageResponse> {
  const parsedMessage = messageSchema.safeParse(message);
  if (!parsedMessage.success) {
    return { success: false, error: "Invalid message format" };
  }

  try {
    return await dispatchMessage(parsedMessage.data);
  } catch (error) {
    return parseMessageResponse(parsedMessage.data.type, {
      success: false,
      error: getErrorMessage(error),
    });
  }
}

/** Routes a validated message using its discriminant. */
function dispatchMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case messageTypes.GET_CONFIG:
      return handleGetConfig();
    case messageTypes.SET_CONFIG:
      return handleSetConfig(message.payload);
    case messageTypes.CONVERT_CURRENCIES:
      return handleConvertCurrencies(message);
    case messageTypes.GET_RATES:
      return handleGetRates();
    default:
      return assertNever(message);
  }
}

/** Returns runtime-validated user configuration. */
async function handleGetConfig(): Promise<MessageResponse> {
  const config = await getConfig();
  return getConfigResponseSchema.parse({ success: true, data: config });
}

/** Persists validated user configuration and echoes the stored value. */
async function handleSetConfig(
  config: Parameters<typeof setConfig>[0],
): Promise<MessageResponse> {
  await setConfig(config);
  return setConfigResponseSchema.parse({ success: true, data: config });
}

/** Converts the requested batch against the retained last-good rates. */
async function handleConvertCurrencies(
  request: ConvertCurrenciesRequest,
): Promise<MessageResponse> {
  const cache = await getExchangeRateCache();
  if (!cache) {
    return convertCurrenciesResponseSchema.parse({
      success: false,
      error: "Exchange rates are not available yet.",
    });
  }

  const snapshot = getRateSnapshot(cache);
  const results = convertCurrencyBatch(
    cache,
    request.payload.amounts,
    request.payload.targetCurrencies,
  );
  return convertCurrenciesResponseSchema.parse({
    success: true,
    data: { ...snapshot, results },
  });
}

/** Returns the retained rates together with freshness metadata. */
async function handleGetRates(): Promise<MessageResponse> {
  const cache = await getExchangeRateCache();
  if (!cache) {
    return getRatesResponseSchema.parse({
      success: false,
      error: "Exchange rates are not available yet.",
    });
  }

  return getRatesResponseSchema.parse({
    success: true,
    data: { ...getRateSnapshot(cache), rates: cache.rates },
  });
}

/** Ensures the alarm at each lifecycle entry and refreshes missing or stale data. */
async function ensureAndRefreshRates(refreshRegardlessOfAge: boolean): Promise<void> {
  await ensureRateRefreshAlarm(browser.alarms);
  const cache = await getExchangeRateCache();
  if (refreshRegardlessOfAge || !cache || isExchangeRateCacheStale(cache)) {
    await refreshRates();
  }
}

/** Fetches a fully validated cache before replacing the existing last-good value. */
function refreshRates(): Promise<void> {
  if (activeRateRefresh) {
    return activeRateRefresh;
  }

  activeRateRefresh = performRateRefresh().finally(() => {
    activeRateRefresh = null;
  });
  return activeRateRefresh;
}

/** Performs one network refresh after the single-flight guard grants ownership. */
async function performRateRefresh(): Promise<void> {
  const cache = await fetchExchangeRateCache(RATE_ENDPOINT);
  await setExchangeRateCache(cache);
}

/** Observes a background promise so listener callbacks never create unhandled rejections. */
function runBackgroundTask(task: Promise<void>, context: string): void {
  void task.catch((error: unknown) => {
    // A stale warning remains visible to users while this diagnostic aids extension debugging.
    console.error(`[Currency Lens] Failed ${context}`, error);
  });
}

/** Converts an unknown failure into a safe response message. */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected background error";
}

/** Makes message routing exhaustive as new request variants are introduced. */
function assertNever(message: never): never {
  throw new Error(`Unhandled message: ${JSON.stringify(message)}`);
}
