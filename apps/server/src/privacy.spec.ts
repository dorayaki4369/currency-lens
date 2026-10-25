import { describe, expect, it, vi } from "vitest";
import { createApp } from "./index";
import { createBindings } from "../test/fixtures";

/** Creates Worker dependencies whose calls reveal any access to rate storage or OXR. */
function createUnusedDependencies() {
  return {
    getLatestRates: vi.fn(),
    fetchLatestRates: vi.fn(),
    putLatestRates: vi.fn(),
    logError: vi.fn(),
  };
}

describe("privacy policy page", () => {
  it("serves an HTML page without reading rate storage or calling OXR", async () => {
    const dependencies = createUnusedDependencies();
    const app = createApp(dependencies);

    const response = await app.request("/privacy", {}, createBindings());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
    expect(dependencies.getLatestRates).not.toHaveBeenCalled();
    expect(dependencies.fetchLatestRates).not.toHaveBeenCalled();
    expect(dependencies.putLatestRates).not.toHaveBeenCalled();
  });

  it("forbids scripts, external resources, embedding, and referrer leakage", async () => {
    const response = await createApp(createUnusedDependencies()).request(
      "/privacy",
      {},
      createBindings(),
    );

    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });
});
