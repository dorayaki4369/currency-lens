import { z } from "zod/v4";
import { currencies } from "@cl/currency";

const currencyCodeSchema = z.enum(currencies.map((c) => c.code) as string[]).brand<"CurrencyCode">();

export const messageTypes = {
  GET_CONFIG: "GET_CONFIG",
  SET_CONFIG: "SET_CONFIG",
  CONVERT_CURRENCY: "CONVERT_CURRENCY",
  GET_RATES: "GET_RATES",
} as const;

export const getConfigRequestSchema = z.object({
  type: z.literal(messageTypes.GET_CONFIG),
});

export const getConfigResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      favorites: z.array(currencyCodeSchema),
      defaultConversions: z.record(z.string(), currencyCodeSchema),
      theme: z.enum(["light", "dark", "system"]),
      showCurrencyIcon: z.boolean(),
      showCurrencyCode: z.boolean(),
    })
    .optional(),
  error: z.string().optional(),
});

export const convertCurrencyRequestSchema = z.object({
  type: z.literal(messageTypes.CONVERT_CURRENCY),
  payload: z.object({
    amount: z.number(),
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
  }),
});

export const convertCurrencyResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      amount: z.number(),
      fromCurrency: currencyCodeSchema,
      toCurrency: currencyCodeSchema,
      convertedAmount: z.string(),
      rate: z.string(),
      timestamp: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

export const getRatesRequestSchema = z.object({
  type: z.literal(messageTypes.GET_RATES),
});

export const getRatesResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      rates: z.record(currencyCodeSchema, z.string()),
      timestamp: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

export type GetConfigRequest = z.infer<typeof getConfigRequestSchema>;
export type GetConfigResponse = z.infer<typeof getConfigResponseSchema>;
export type ConvertCurrencyRequest = z.infer<typeof convertCurrencyRequestSchema>;
export type ConvertCurrencyResponse = z.infer<typeof convertCurrencyResponseSchema>;
export type GetRatesRequest = z.infer<typeof getRatesRequestSchema>;
export type GetRatesResponse = z.infer<typeof getRatesResponseSchema>;

export type Message = GetConfigRequest | ConvertCurrencyRequest | GetRatesRequest;
export type MessageResponse = GetConfigResponse | ConvertCurrencyResponse | GetRatesResponse;

export async function sendMessage<TResponse extends MessageResponse>(message: Message): Promise<TResponse> {
  return browser.runtime.sendMessage(message) as Promise<TResponse>;
}
