import { z } from "zod/v4";
import { currencies } from "@cl/currency";

const currencySchema = z.enum(currencies.map((c) => c.code) as string[]).brand<"Currency">();
export type Currency = z.infer<typeof currencySchema>;

export const oxrLatestResponseSchema = z.object({
  disclaimer: z.string(),
  license: z.string(),
  base: currencySchema,
  rates: z.record(currencySchema, z.coerce.string()), // force to string from number because the js double precision is not good
  timestamp: z.number(), // unix timestamp in seconds
});

export type OxrLatestResponse = z.infer<typeof oxrLatestResponseSchema>;
