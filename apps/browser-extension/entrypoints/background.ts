import { getConfig, getExchangeRateCache } from "../lib/storage";
import {
  messageTypes,
  type GetConfigRequest,
  type ConvertCurrencyRequest,
  type GetRatesRequest,
  type MessageResponse,
} from "../lib/messages";

export default defineBackground(() => {
  console.log("Currency Lens background script initialized", { id: browser.runtime.id });

  browser.runtime.onMessage.addListener(
    (message: unknown, sender: browser.Runtime.MessageSender, sendResponse: (response?: MessageResponse) => void) => {
      handleMessage(message)
        .then((response) => {
          sendResponse(response);
        })
        .catch((error) => {
          console.error("Error handling message:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });

      return true;
    },
  );
});

async function handleMessage(message: unknown): Promise<MessageResponse> {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return {
      success: false,
      error: "Invalid message format",
    };
  }

  const { type } = message;

  switch (type) {
    case messageTypes.GET_CONFIG:
      return handleGetConfig(message as GetConfigRequest);
    case messageTypes.CONVERT_CURRENCY:
      return handleConvertCurrency(message as ConvertCurrencyRequest);
    case messageTypes.GET_RATES:
      return handleGetRates(message as GetRatesRequest);
    default:
      return {
        success: false,
        error: `Unknown message type: ${String(type)}`,
      };
  }
}

async function handleGetConfig(): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    return {
      success: true,
      data: config,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get config",
    };
  }
}

async function handleConvertCurrency(request: ConvertCurrencyRequest): Promise<MessageResponse> {
  try {
    const { amount, fromCurrency, toCurrency } = request.payload;

    const cache = await getExchangeRateCache();

    if (!cache) {
      return {
        success: false,
        error: "Exchange rates not available. Please try again later.",
      };
    }

    const fromRate = cache.rates[fromCurrency];
    const toRate = cache.rates[toCurrency];

    if (!fromRate || !toRate) {
      return {
        success: false,
        error: `Exchange rate not available for ${fromCurrency} or ${toCurrency}`,
      };
    }

    const amountInUSD = amount / Number.parseFloat(fromRate);
    const convertedAmount = amountInUSD * Number.parseFloat(toRate);

    const rate = (Number.parseFloat(toRate) / Number.parseFloat(fromRate)).toString();

    return {
      success: true,
      data: {
        amount,
        fromCurrency,
        toCurrency,
        convertedAmount: convertedAmount.toFixed(2),
        rate,
        timestamp: cache.timestamp,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to convert currency",
    };
  }
}

async function handleGetRates(): Promise<MessageResponse> {
  try {
    const cache = await getExchangeRateCache();

    if (!cache) {
      return {
        success: false,
        error: "Exchange rates not available. Please try again later.",
      };
    }

    return {
      success: true,
      data: {
        rates: cache.rates,
        timestamp: cache.timestamp,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get rates",
    };
  }
}
