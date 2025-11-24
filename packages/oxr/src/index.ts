import { OxrLatestResponse, oxrLatestResponseSchema } from "./schema";

export type Config = {
  baseUrl: string;
  appId: string;
};

export async function latestRate(config: Config): Promise<OxrLatestResponse> {
  const query = new URLSearchParams();
  query.set("show_alternative", "true");
  query.set("prettyprint", "0");

  const response = await fetcher(`/latest.json?${query.toString()}`, { method: "GET" }, config);

  return oxrLatestResponseSchema.parse(await response.json());
}

async function fetcher(path: string, init: RequestInit | undefined, config: Config) {
  const url = new URL(path, config.baseUrl);

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Token ${config.appId}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });
}
