import { z } from "zod/v4";
import { MAX_FAVORITE_CURRENCIES, configSchema, currencyCodeSchema } from "@/lib/currency";
import {
  MAX_CONVERSION_AMOUNTS,
  conversionResultSchema,
  exchangeRateCacheSchema,
  rateWarningSchema,
} from "@/lib/rates";
import { rateHistoryQuerySchema, rateHistorySchema } from "@/lib/rate-history";
import {
  CHANGE_DIRECTIONS,
  chartColorSettingsSchema,
  hexColorSchema,
} from "@/lib/trend-colors";

export const messageTypes = {
  GET_CONFIG: "GET_CONFIG",
  SET_CONFIG: "SET_CONFIG",
  CONVERT_CURRENCIES: "CONVERT_CURRENCIES",
  GET_RATES: "GET_RATES",
  GET_RATE_HISTORY: "GET_RATE_HISTORY",
  GET_CHART_COLORS: "GET_CHART_COLORS",
  SET_CHART_COLORS: "SET_CHART_COLORS",
} as const;

const failureResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string().min(1),
  })
  .strict();

const rateMetadataSchema = z
  .object({
    base: currencyCodeSchema,
    sourceTimestamp: z.number().int().nonnegative(),
    fetchedAt: z.number().int().nonnegative(),
    isStale: z.boolean(),
    warnings: z.array(rateWarningSchema).max(1),
  })
  .strict();

const conversionAmountSchema = z
  .object({
    amount: z.number().positive(),
    currencyCode: currencyCodeSchema,
  })
  .strict();

const targetCurrenciesSchema = z
  .array(currencyCodeSchema)
  .min(1)
  .max(MAX_FAVORITE_CURRENCIES)
  .refine(
    (codes) => new Set(codes).size === codes.length,
    "Target currencies must be unique",
  );

export const getConfigRequestSchema = z
  .object({ type: z.literal(messageTypes.GET_CONFIG) })
  .strict();

export const getConfigResponseSchema = z.union([
  z.object({ success: z.literal(true), data: configSchema }).strict(),
  failureResponseSchema,
]);

export const setConfigRequestSchema = z
  .object({
    type: z.literal(messageTypes.SET_CONFIG),
    payload: configSchema,
  })
  .strict();

export const setConfigResponseSchema = z.union([
  z.object({ success: z.literal(true), data: configSchema }).strict(),
  failureResponseSchema,
]);

export const convertCurrenciesRequestSchema = z
  .object({
    type: z.literal(messageTypes.CONVERT_CURRENCIES),
    payload: z
      .object({
        amounts: z.array(conversionAmountSchema).min(1).max(MAX_CONVERSION_AMOUNTS),
        targetCurrencies: targetCurrenciesSchema,
      })
      .strict(),
  })
  .strict();

export const convertCurrenciesResponseSchema = z.union([
  z
    .object({
      success: z.literal(true),
      data: rateMetadataSchema.extend({
        results: z
          .array(conversionResultSchema)
          .max(MAX_CONVERSION_AMOUNTS * MAX_FAVORITE_CURRENCIES),
      }),
    })
    .strict(),
  failureResponseSchema,
]);

export const getRatesRequestSchema = z
  .object({ type: z.literal(messageTypes.GET_RATES) })
  .strict();

export const getRatesResponseSchema = z.union([
  z
    .object({
      success: z.literal(true),
      data: rateMetadataSchema.extend({ rates: exchangeRateCacheSchema.shape.rates }),
    })
    .strict(),
  failureResponseSchema,
]);

export const getRateHistoryRequestSchema = z
  .object({
    type: z.literal(messageTypes.GET_RATE_HISTORY),
    payload: rateHistoryQuerySchema,
  })
  .strict();

export const getRateHistoryResponseSchema = z.union([
  z.object({ success: z.literal(true), data: rateHistorySchema }).strict(),
  failureResponseSchema,
]);

export const getChartColorsRequestSchema = z
  .object({ type: z.literal(messageTypes.GET_CHART_COLORS) })
  .strict();

export const setChartColorsRequestSchema = z
  .object({
    type: z.literal(messageTypes.SET_CHART_COLORS),
    // One direction at a time; null returns it to the locale default.
    payload: z
      .object({ color: hexColorSchema.nullable(), direction: z.enum(CHANGE_DIRECTIONS) })
      .strict(),
  })
  .strict();

const chartColorsResponseSchema = z.union([
  z.object({ success: z.literal(true), data: chartColorSettingsSchema.strict() }).strict(),
  failureResponseSchema,
]);

export const getChartColorsResponseSchema = chartColorsResponseSchema;
export const setChartColorsResponseSchema = chartColorsResponseSchema;

export const messageSchema = z.discriminatedUnion("type", [
  getConfigRequestSchema,
  setConfigRequestSchema,
  convertCurrenciesRequestSchema,
  getRatesRequestSchema,
  getRateHistoryRequestSchema,
  getChartColorsRequestSchema,
  setChartColorsRequestSchema,
]);

export type GetConfigRequest = z.infer<typeof getConfigRequestSchema>;
export type GetConfigResponse = z.infer<typeof getConfigResponseSchema>;
export type SetConfigRequest = z.infer<typeof setConfigRequestSchema>;
export type SetConfigResponse = z.infer<typeof setConfigResponseSchema>;
export type ConvertCurrenciesRequest = z.infer<typeof convertCurrenciesRequestSchema>;
export type ConvertCurrenciesResponse = z.infer<typeof convertCurrenciesResponseSchema>;
export type GetRatesRequest = z.infer<typeof getRatesRequestSchema>;
export type GetRatesResponse = z.infer<typeof getRatesResponseSchema>;
export type GetRateHistoryRequest = z.infer<typeof getRateHistoryRequestSchema>;
export type GetRateHistoryResponse = z.infer<typeof getRateHistoryResponseSchema>;
export type GetChartColorsRequest = z.infer<typeof getChartColorsRequestSchema>;
export type SetChartColorsRequest = z.infer<typeof setChartColorsRequestSchema>;
export type ChartColorsResponse = z.infer<typeof chartColorsResponseSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageResponse =
  | GetConfigResponse
  | SetConfigResponse
  | ConvertCurrenciesResponse
  | GetRatesResponse
  | GetRateHistoryResponse
  | ChartColorsResponse;

const responseSchemaByMessageType: Record<Message["type"], z.ZodType<MessageResponse>> = {
  [messageTypes.CONVERT_CURRENCIES]: convertCurrenciesResponseSchema,
  [messageTypes.GET_CONFIG]: getConfigResponseSchema,
  [messageTypes.GET_RATES]: getRatesResponseSchema,
  [messageTypes.GET_RATE_HISTORY]: getRateHistoryResponseSchema,
  [messageTypes.GET_CHART_COLORS]: getChartColorsResponseSchema,
  [messageTypes.SET_CHART_COLORS]: setChartColorsResponseSchema,
  [messageTypes.SET_CONFIG]: setConfigResponseSchema,
};

/** Sends a validated request and validates the corresponding background response. */
export function sendMessage(message: GetConfigRequest): Promise<GetConfigResponse>;
export function sendMessage(message: SetConfigRequest): Promise<SetConfigResponse>;
export function sendMessage(
  message: ConvertCurrenciesRequest,
): Promise<ConvertCurrenciesResponse>;
export function sendMessage(message: GetRatesRequest): Promise<GetRatesResponse>;
export function sendMessage(
  message: GetRateHistoryRequest,
): Promise<GetRateHistoryResponse>;
export function sendMessage(message: GetChartColorsRequest): Promise<ChartColorsResponse>;
export function sendMessage(message: SetChartColorsRequest): Promise<ChartColorsResponse>;
export async function sendMessage(message: Message): Promise<MessageResponse> {
  const validatedMessage = messageSchema.parse(message);
  const response: unknown = await browser.runtime.sendMessage(validatedMessage);
  return parseMessageResponse(validatedMessage.type, response);
}

/** Validates a response with the schema selected by its originating request type. */
export function parseMessageResponse(
  messageType: Message["type"],
  response: unknown,
): MessageResponse {
  return responseSchemaByMessageType[messageType].parse(response);
}
