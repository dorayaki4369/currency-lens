import { putOxrLatestResponse } from "./bucket";
import { latestRate } from "@cl/oxr";

export const scheduledHandler: ExportedHandlerScheduledHandler<CloudflareBindings> = async (event, env) => {
  const data = await latestRate({
    baseUrl: env.OPEN_EXCHANGE_RATE_API_URL,
    appId: env.OPEN_EXCHANGE_RATE_APP_ID,
  });

  console.log("Fetched latest rate", data);

  await putOxrLatestResponse(data, env);
};
