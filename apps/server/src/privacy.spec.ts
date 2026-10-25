import { describe, expect, it, vi } from "vitest";
import { createApp } from "./index";
import { createBindings } from "../test/fixtures";

/** Creates Worker dependencies that fail the test if the privacy page touches rate storage. */
function createUnusedDependencies() {
  return {
    getLatestRates: vi.fn(),
    fetchLatestRates: vi.fn(),
    putLatestRates: vi.fn(),
    logError: vi.fn(),
  };
}

describe("privacy policy page", () => {
  it("serves a self-contained HTML policy without reading rate storage", async () => {
    const dependencies = createUnusedDependencies();
    const app = createApp(dependencies);

    const response = await app.request("/privacy", {}, createBindings());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
    expect(body).toMatch(/^<!doctype html>/u);
    expect(body).toContain('<html lang="en">');
    expect(body).toContain("<title>Currency Lens Privacy Policy</title>");
    expect(body).not.toMatch(/<script|<link|src=/u);
    expect(dependencies.getLatestRates).not.toHaveBeenCalled();
    expect(dependencies.fetchLatestRates).not.toHaveBeenCalled();
  });

  it("states what the extension keeps local, what it sends, and how to make contact", async () => {
    const response = await createApp(createUnusedDependencies()).request(
      "/privacy",
      {},
      createBindings(),
    );
    // Source formatting may wrap prose anywhere, so compare the text as a browser would render it.
    const body = (await response.text()).replace(/\s+/gu, " ");

    expect(body).toContain("Effective date: October 25, 2026");
    expect(body).toContain("are never sent to us or to anyone else");
    expect(body).toContain("<code>storage.sync</code>");
    expect(body).toContain("<code>storage.local</code>");
    expect(body).toContain("<code>https://cl.dryk.net</code>");
    expect(body).toContain("We do not use analytics, advertising, or tracking.");
    expect(body).toContain(
      '<a href="mailto:ryuya.hirayama@dryk.net">ryuya.hirayama@dryk.net</a>',
    );
  });

  it("forbids scripts, embedding, and referrer leakage", async () => {
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
