import { z } from "zod/v4";

/**
 * OXR includes non-ISO and digital currency identifiers, and may add new ones
 * independently from this repository's currency metadata.
 */
export const currencyIdentifierSchema = z.string().regex(/^[A-Z0-9][A-Z0-9_]{1,31}$/);
export const currencySchema = currencyIdentifierSchema.brand<"Currency">();
export type Currency = z.infer<typeof currencySchema>;

/** Validates a positive exchange rate and stores it in a stable string form. */
export const exchangeRateSchema = z.union([
  z
    .number()
    .finite()
    .positive()
    .transform((rate) => rate.toString()),
  z
    .string()
    .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/)
    .refine((rate) => Number.isFinite(Number(rate)) && Number(rate) > 0),
]);

/**
 * Validates the complete upstream response while permitting newly introduced
 * currency identifiers in the rates record.
 */
export const oxrLatestResponseSchema = z
  .object({
    disclaimer: z.string().min(1),
    license: z.string().min(1),
    base: currencySchema,
    rates: z.record(currencyIdentifierSchema, exchangeRateSchema),
    timestamp: z.number().int().positive(),
  })
  .superRefine((response, context) => {
    const baseRate = response.rates[response.base];
    if (baseRate === undefined) {
      context.addIssue({
        code: "custom",
        message: "The base currency must be present in rates",
        path: ["rates", response.base],
      });
    } else if (Number(baseRate) !== 1) {
      context.addIssue({
        code: "custom",
        message: "The base currency rate must equal 1",
        path: ["rates", response.base],
      });
    }
  });

export type OxrLatestResponse = z.infer<typeof oxrLatestResponseSchema>;
