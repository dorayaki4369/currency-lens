import { putOxrLatestResponse } from "./bucket";
import { fetchLatestRate } from "@cl/oxr";

export const scheduledHandler: ExportedHandlerScheduledHandler<CloudflareBindings> = async (_, env) => {
  const data = await fetchLatestRate({
    baseUrl: env.OPEN_EXCHANGE_RATE_API_URL,
    appId: env.OPEN_EXCHANGE_RATE_APP_ID,
  });

  console.log("Fetched latest rate", data);

  const object = await putOxrLatestResponse(data, env);
  console.log("Stored latest rate to bucket", {
    key: object.key,
    size: object.size,
    customMetadata: object.customMetadata,
  });
};
