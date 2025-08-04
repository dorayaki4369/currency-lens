import { z } from "zod/v4";
import { currencySchema } from "./const";

export const oxrLatestResponseSchema = z.object({
    disclaimer: z.string(),
    license: z.string(),
    base: currencySchema,
    rates: z.record(currencySchema, z.coerce.string()), // force to string from number because the js duble precision is not good
    timestamp: z.number(), // seconds precision
});

export type OxrLatestResponse = z.infer<typeof oxrLatestResponseSchema>;
