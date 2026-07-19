import { describe, expect, it } from "vitest";
import type { ConfigEnv } from "wxt";

import { createManifest, createViteConfig, resolveApiEndpoint } from "./wxt.config";

const PRODUCTION_API_ENDPOINT = "https://cl.dryk.net";
const DEVELOPMENT_ENV = {
  browser: "chrome",
  command: "serve",
  manifestVersion: 3,
  mode: "development",
} satisfies ConfigEnv;

const PRODUCTION_ENV = {
  ...DEVELOPMENT_ENV,
  command: "build",
  mode: "production",
} satisfies ConfigEnv;

describe("WXT API endpoint configuration", () => {
  it("uses the configured API base URL in development code and host permissions", () => {
    const endpoint = "http://localhost:9876/custom";

    expect(createManifest(DEVELOPMENT_ENV, endpoint).host_permissions).toEqual([
      "http://localhost/*",
    ]);
    expect(createViteConfig(DEVELOPMENT_ENV, endpoint).define).toEqual({
      "import.meta.env.API_ENDPOINT": JSON.stringify(endpoint),
    });
  });

  it("uses the same API_ENDPOINT input for production builds", () => {
    expect(resolveApiEndpoint(`${PRODUCTION_API_ENDPOINT}/`)).toBe(PRODUCTION_API_ENDPOINT);
    expect(
      createManifest(PRODUCTION_ENV, PRODUCTION_API_ENDPOINT).host_permissions,
    ).toEqual(["https://cl.dryk.net/*"]);
    expect(createViteConfig(PRODUCTION_ENV, PRODUCTION_API_ENDPOINT).define).toEqual({
      "import.meta.env.API_ENDPOINT": JSON.stringify(PRODUCTION_API_ENDPOINT),
    });
  });

  it("rejects missing or unsafe API endpoints for every build mode", () => {
    expect(() => resolveApiEndpoint(undefined)).toThrow("API_ENDPOINT is required");
    expect(() => resolveApiEndpoint("http://example.com")).toThrow(
      "must use HTTPS or HTTP on a loopback host",
    );
    expect(() => resolveApiEndpoint("https://user:password@example.com")).toThrow(
      "must not contain credentials",
    );
    expect(() => resolveApiEndpoint("https://example.com?source=invalid")).toThrow(
      "must not contain query parameters",
    );
  });
});
