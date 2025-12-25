import { z } from "zod/v4";
import { currencies } from "@cl/currency";

const currencyCodeSchema = z.enum(currencies.map((c) => c.code) as string[]).brand<"CurrencyCode">();

export const configSchema = z.object({
  favorites: z.array(currencyCodeSchema),
  // example: { "$": "USD", "¥": "JPY" }
  defaultConversions: z.record(z.string(), currencyCodeSchema),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  showCurrencyIcon: z.boolean().default(true),
  showCurrencyCode: z.boolean().default(true),
});
