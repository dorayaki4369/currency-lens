// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageManifest from "@/package.json" with { type: "json" };
import { POPUP_PREVIEW, renderPopup, resetPopupTestEnvironment } from "@/test/popup";

afterEach(() => {
  vi.unstubAllEnvs();
  resetPopupTestEnvironment();
});

describe("popup about route", () => {
  it("shows the version, terms, and external links, then restores focus on return", async () => {
    vi.stubEnv("BROWSER", "chrome");
    await renderPopup(POPUP_PREVIEW);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "About" }));

    expect(await screen.findByRole("heading", { level: 1, name: "About" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "Currency Lens" })).toBeDefined();
    expect(screen.getByText(`Version ${packageManifest.version}`)).toBeDefined();
    expect(screen.getByText("MIT")).toBeDefined();
    expect(screen.getByText("© 2026 Ryuya Hirayama")).toBeDefined();
    expect(readLink("Open Exchange Rates (opens in a new tab)")).toEqual({
      href: "https://openexchangerates.org/",
      rel: "noreferrer",
      target: "_blank",
    });
    expect(readLink("Write a review on Chrome Web Store (opens in a new tab)").href).toBe(
      "https://chromewebstore.google.com/detail/cfpmgblhfmfomcgkpkghcgkcfblbpgkm/reviews",
    );
    expect(readLink("Source code (opens in a new tab)").href).toBe(
      "https://github.com/dorayaki4369/currency-lens",
    );
    expect(readLink("Privacy policy (opens in a new tab)").href).toBe(
      "https://cl.dryk.net/privacy",
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" })),
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "About" })),
    );
  });

  it("links Firefox builds to Firefox Add-ons in Japanese", async () => {
    vi.stubEnv("BROWSER", "firefox");
    await renderPopup({ ...POPUP_PREVIEW, locale: "ja" });
    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }));
    fireEvent.click(await screen.findByRole("button", { name: "このアプリについて" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "このアプリについて" }),
    ).toBeDefined();
    expect(screen.getByText("為替レートの提供元")).toBeDefined();
    expect(readLink("Firefox Add-onsでレビューを書く （新しいタブで開きます）").href).toBe(
      "https://addons.mozilla.org/firefox/addon/currency-lens/",
    );
  });

  it("omits the review link when the build target has no store listing", async () => {
    await renderPopup(POPUP_PREVIEW);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "About" }));

    expect(await screen.findByRole("heading", { level: 1, name: "About" })).toBeDefined();
    expect(screen.queryByRole("link", { name: /review/iu })).toBeNull();
  });
});

/** Reads the attributes that decide where an external link opens. */
function readLink(name: string): {
  href: string;
  rel: string | null;
  target: string | null;
} {
  const link = screen.getByRole<HTMLAnchorElement>("link", { name });
  return {
    href: link.href,
    rel: link.getAttribute("rel"),
    target: link.getAttribute("target"),
  };
}
