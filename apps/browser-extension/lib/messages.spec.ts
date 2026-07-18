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
  it("accepts the complete three-by-five request boundary", () => {
    const request = createConversionRequest(3, ["USD", "EUR", "JPY", "GBP", "CAD"]);
    expect(convertCurrenciesRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects more than three source amounts", () => {
    const request = createConversionRequest(4, ["EUR"]);
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
});
