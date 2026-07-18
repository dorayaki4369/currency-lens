import { z } from "zod/v4";
import { MAX_FAVORITE_CURRENCIES, configSchema, currencyCodeSchema } from "./currency";
import {
  MAX_CONVERSION_AMOUNTS,
  conversionResultSchema,
  exchangeRateCacheSchema,
  rateWarningSchema,
} from "./rates";

export const messageTypes = {
  GET_CONFIG: "GET_CONFIG",
  SET_CONFIG: "SET_CONFIG",
  CONVERT_CURRENCIES: "CONVERT_CURRENCIES",
  GET_RATES: "GET_RATES",
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

export const messageSchema = z.discriminatedUnion("type", [
  getConfigRequestSchema,
  setConfigRequestSchema,
  convertCurrenciesRequestSchema,
  getRatesRequestSchema,
]);

export type GetConfigRequest = z.infer<typeof getConfigRequestSchema>;
export type GetConfigResponse = z.infer<typeof getConfigResponseSchema>;
export type SetConfigRequest = z.infer<typeof setConfigRequestSchema>;
export type SetConfigResponse = z.infer<typeof setConfigResponseSchema>;
export type ConvertCurrenciesRequest = z.infer<typeof convertCurrenciesRequestSchema>;
export type ConvertCurrenciesResponse = z.infer<typeof convertCurrenciesResponseSchema>;
export type GetRatesRequest = z.infer<typeof getRatesRequestSchema>;
export type GetRatesResponse = z.infer<typeof getRatesResponseSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageResponse =
  | GetConfigResponse
  | SetConfigResponse
  | ConvertCurrenciesResponse
  | GetRatesResponse;

/** Sends a validated request and validates the corresponding background response. */
export function sendMessage(message: GetConfigRequest): Promise<GetConfigResponse>;
export function sendMessage(message: SetConfigRequest): Promise<SetConfigResponse>;
export function sendMessage(
  message: ConvertCurrenciesRequest,
): Promise<ConvertCurrenciesResponse>;
export function sendMessage(message: GetRatesRequest): Promise<GetRatesResponse>;
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
  switch (messageType) {
    case messageTypes.GET_CONFIG:
      return getConfigResponseSchema.parse(response);
    case messageTypes.SET_CONFIG:
      return setConfigResponseSchema.parse(response);
    case messageTypes.CONVERT_CURRENCIES:
      return convertCurrenciesResponseSchema.parse(response);
    case messageTypes.GET_RATES:
      return getRatesResponseSchema.parse(response);
    default:
      return assertNever(messageType);
  }
}

/** Makes response-schema routing exhaustive as new request variants are introduced. */
function assertNever(_messageType: never): never {
  throw new Error("Unhandled message type");
}
