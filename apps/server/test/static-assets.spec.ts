import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

const server = createTestHarness({
  workers: [
    { configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url).href) },
  ],
});

beforeAll(async () => {
  await server.listen();
}, 60_000);

afterAll(async () => {
  await server.close();
});

describe("static privacy policy", () => {
  it("serves the page as HTML at /privacy", async () => {
    const response = await server.fetch("/privacy");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/^text\/html\b/u);
  });

  it("forbids scripts, external resources, embedding, and referrer leakage", async () => {
    const response = await server.fetch("/privacy");

    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("does not publish the header rules or the file name as pages", async () => {
    const [headersResponse, fileResponse] = await Promise.all([
      server.fetch("/_headers"),
      server.fetch("/privacy.html", { redirect: "manual" }),
    ]);

    expect(headersResponse.status).not.toBe(200);
    expect(fileResponse.status).toBe(307);
    expect(fileResponse.headers.get("Location")).toBe("/privacy");
  });
});
