import { describe, expect, it, vi } from "vitest";
import {
  getLatestOxrResponse,
  InvalidStoredRatesError,
  putOxrLatestResponse,
} from "./bucket";
import { createBindings, createR2Object, createRatesSnapshot } from "../test/fixtures";

describe("getLatestOxrResponse", () => {
  it("returns null when the latest object does not exist", async () => {
    const get = vi.fn(async () => null);
    const env = createBindings({
      bucket: { get } as unknown as R2Bucket,
    });

    await expect(getLatestOxrResponse(env)).resolves.toBeNull();
  });

  it("validates R2 JSON while retaining unknown currency identifiers", async () => {
    const get = vi.fn(async () => ({
      json: async () => ({
        disclaimer: "Example disclaimer",
        license: "Example license",
        base: "USD",
        rates: { USD: 1, FUTURE_COIN: 0.25 },
        timestamp: 1_700_000_000,
      }),
    }));
    const env = createBindings({
      bucket: { get } as unknown as R2Bucket,
    });

    const result = await getLatestOxrResponse(env);

    expect(result?.rates["FUTURE_COIN"]).toBe("0.25");
  });

  it.each([
    async () => {
      throw new SyntaxError("invalid JSON");
    },
    async () => ({ rates: { USD: 1 } }),
  ])("rejects an untrusted R2 payload", async (readJson: () => Promise<unknown>) => {
    const get = vi.fn(async () => ({ json: readJson }));
    const env = createBindings({
      bucket: { get } as unknown as R2Bucket,
    });

    await expect(getLatestOxrResponse(env)).rejects.toBeInstanceOf(InvalidStoredRatesError);
  });
});

describe("putOxrLatestResponse", () => {
  it("stores the source timestamp in both the latest and archive objects", async () => {
    const put = vi.fn(
      async (
        key: string,
        _value: Parameters<R2Bucket["put"]>[1],
        _options?: R2PutOptions,
      ) => createR2Object(key),
    );
    const env = createBindings({
      bucket: { put } as unknown as R2Bucket,
    });
    const data = createRatesSnapshot();

    const result = await putOxrLatestResponse(data, env);

    expect(result.key).toBe("2023-11-14T22:13:20.000Z.json");
    expect(put).toHaveBeenCalledTimes(2);
    const expectedMetadata = {
      customMetadata: {
        url: "https://openexchangerates.org/api",
        sourceTimestamp: "1700000000",
        sourceDatetime: "2023-11-14T22:13:20.000Z",
        base: "USD",
      },
    };
    expect(put).toHaveBeenNthCalledWith(
      1,
      "2023-11-14T22:13:20.000Z.json",
      JSON.stringify(data),
      expectedMetadata,
    );
    expect(put).toHaveBeenNthCalledWith(
      2,
      "latest.json",
      JSON.stringify(data),
      expectedMetadata,
    );
  });
});
