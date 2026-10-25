import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { ConfigEnv, PublicPathEntry, ResolvedPublicFile } from "wxt";

import { currencyFlagRegions } from "@/lib/currency-flags";
import wxtConfig, {
  addCurrencyFlagPublicAssets,
  addCurrencyFlagPublicPath,
  createManifest,
  createViteConfig,
  resolveApiEndpoint,
} from "@/wxt.config";

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

  it("ships localized manifest metadata with English as the fallback", () => {
    expect(createManifest(PRODUCTION_ENV, PRODUCTION_API_ENDPOINT)).toMatchObject({
      default_locale: "en",
      description: "__MSG_extensionDescription__",
      name: "__MSG_extensionName__",
      web_accessible_resources: [
        {
          matches: ["<all_urls>"],
          resources: ["currency-flags/*.svg"],
        },
      ],
    });
  });

  it("requires a desktop Firefox that understands the data collection declaration", () => {
    // `data_collection_permissions` is supported from Firefox 140; AMO warns about older minimums.
    expect(
      createManifest(PRODUCTION_ENV, PRODUCTION_API_ENDPOINT).browser_specific_settings,
    ).toEqual({
      gecko: {
        data_collection_permissions: { required: ["none"] },
        id: "currency-lens@dryk.net",
        strict_min_version: "140.0",
      },
    });
  });

  it("rejects missing or unsafe API endpoints for every build mode", () => {
    expect(() => resolveApiEndpoint(undefined)).toThrow("API_ENDPOINT is required");
    expect(() => resolveApiEndpoint(" ")).toThrow("API_ENDPOINT is required");
    expect(() => resolveApiEndpoint("not a URL")).toThrow("must be an absolute URL");
    expect(() => resolveApiEndpoint("http://example.com")).toThrow(
      "must use HTTPS or HTTP on a loopback host",
    );
    expect(() => resolveApiEndpoint("https://user:password@example.com")).toThrow(
      "must not contain credentials",
    );
    expect(() => resolveApiEndpoint("https://example.com?source=invalid")).toThrow(
      "must not contain query parameters",
    );
    expect(() => resolveApiEndpoint("https://example.com#invalid")).toThrow(
      "must not contain a fragment",
    );
  });
});

describe("WXT currency flag assets", () => {
  it("copies only selectable flag-icons files and types their runtime URLs", () => {
    const files: ResolvedPublicFile[] = [];
    const paths: PublicPathEntry[] = [];

    addCurrencyFlagPublicAssets(undefined, files);
    addCurrencyFlagPublicPath(undefined, paths);

    expect(files.map((file) => file.relativeDest)).toEqual(
      currencyFlagRegions.map(
        (regionCode) => `currency-flags/${regionCode.toLowerCase()}.svg`,
      ),
    );
    expect(
      files.every(
        (file) =>
          "absoluteSrc" in file && file.absoluteSrc.endsWith(file.relativeDest.slice(15)),
      ),
    ).toBe(true);
    expect(paths).toEqual([
      { path: "currency-flags/${string}.svg", type: "templateLiteral" },
    ]);
  });
});

describe("WXT browser runner configuration", () => {
  it("serves and opens the local sandbox on a deterministic development URL", async () => {
    expect(wxtConfig.dev?.server).toEqual({
      port: 3000,
      strictPort: true,
    });
    expect(wxtConfig.webExt?.startUrls).toEqual(["http://localhost:3000/sandbox.html"]);

    await expect(
      readFile(new URL("./sandbox.html", import.meta.url), "utf8"),
    ).resolves.toContain("Currency Lens Browser Extension Sandbox Page");
  });

  it("includes shared stores in the Firefox review source archive", () => {
    expect(wxtConfig.zip?.includeSources).toContain("apps/browser-extension/stores/**");
  });
});
