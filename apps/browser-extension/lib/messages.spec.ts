import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultConfig } from "./storage";
import {
  convertCurrenciesRequestSchema,
  messageTypes,
  parseMessageResponse,
  sendMessage,
} from "./messages";

const runtimeSendMessage = vi.fn();

beforeEach(() => {
  runtimeSendMessage.mockReset();
  vi.stubGlobal("browser", {
    runtime: { sendMessage: runtimeSendMessage },
  });
});

describe("message schemas", () => {
  it("accepts the complete one-by-five request boundary", () => {
    const request = createConversionRequest(1, ["USD", "EUR", "JPY", "GBP", "CAD"]);
    expect(convertCurrenciesRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects more than one source amount", () => {
    const request = createConversionRequest(2, ["EUR"]);
    expect(convertCurrenciesRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejects more than five target currencies", () => {
    const request = createConversionRequest(1, ["USD", "EUR", "JPY", "GBP", "CAD", "AUD"]);
    expect(convertCurrenciesRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejects duplicate target currencies", () => {
    const request = createConversionRequest(1, ["EUR", "EUR"]);
    expect(convertCurrenciesRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejects a success response that does not satisfy its request contract", () => {
    expect(() =>
      parseMessageResponse(messageTypes.GET_CONFIG, {
        success: true,
        data: { favorites: ["USD"] },
      }),
    ).toThrow();
  });

  it("selects the response contract for every supported request type", () => {
    const config = getDefaultConfig();
    const rateMetadata = {
      base: "USD",
      sourceTimestamp: 1_700_000_000_000,
      fetchedAt: 1_700_000_005_000,
      isStale: false,
      warnings: [],
    };

    expect(
      parseMessageResponse(messageTypes.SET_CONFIG, { success: true, data: config }),
    ).toEqual({ success: true, data: config });
    expect(
      parseMessageResponse(messageTypes.CONVERT_CURRENCIES, {
        success: true,
        data: {
          ...rateMetadata,
          results: [
            {
              status: "converted",
              sourceIndex: 0,
              amount: 1,
              fromCurrency: "USD",
              toCurrency: "EUR",
              convertedAmount: "0.90",
              rate: "0.9",
              fractionDigits: 2,
            },
          ],
        },
      }),
    ).toMatchObject({ success: true, data: { results: [{ status: "converted" }] } });
    expect(
      parseMessageResponse(messageTypes.GET_RATES, {
        success: true,
        data: { ...rateMetadata, rates: { USD: "1", EUR: "0.9" } },
      }),
    ).toMatchObject({ success: true, data: { rates: { USD: "1", EUR: "0.9" } } });
  });
});

/** Creates an otherwise valid conversion request for one boundary variation. */
function createConversionRequest(amountCount: number, targetCurrencies: string[]) {
  return {
    type: messageTypes.CONVERT_CURRENCIES,
    payload: {
      amounts: Array.from({ length: amountCount }, () => ({
        amount: 1,
        currencyCode: "USD",
      })),
      targetCurrencies,
    },
  };
}

describe("sendMessage", () => {
  it("validates the response selected by the request type", async () => {
    const config = getDefaultConfig();
    runtimeSendMessage.mockResolvedValue({ success: true, data: config });

    await expect(sendMessage({ type: messageTypes.GET_CONFIG })).resolves.toEqual({
      success: true,
      data: config,
    });
    expect(runtimeSendMessage).toHaveBeenCalledWith({ type: messageTypes.GET_CONFIG });
  });

  it("rejects malformed runtime responses instead of trusting a type assertion", async () => {
    runtimeSendMessage.mockResolvedValue({
      success: true,
      data: { rates: "not-a-record" },
    });
    await expect(sendMessage({ type: messageTypes.GET_RATES })).rejects.toThrow();
  });

  it("validates outbound configuration and conversion requests", async () => {
    const config = getDefaultConfig();
    runtimeSendMessage
      .mockResolvedValueOnce({ success: true, data: config })
      .mockResolvedValueOnce({ success: false, error: "rates unavailable" });

    await expect(
      sendMessage({ type: messageTypes.SET_CONFIG, payload: config }),
    ).resolves.toEqual({ success: true, data: config });
    await expect(
      sendMessage({
        type: messageTypes.CONVERT_CURRENCIES,
        payload: {
          amounts: [{ amount: 10, currencyCode: "USD" }],
          targetCurrencies: ["EUR"],
        },
      }),
    ).resolves.toEqual({ success: false, error: "rates unavailable" });
  });
});
