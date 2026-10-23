// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyIcon } from "@/components/currency/CurrencyIcon";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("currency icon", () => {
  it("uses packaged flag assets in extensions and preview paths outside them", () => {
    const getURL = vi.fn<(path: string) => string>(
      (path) => `moz-extension://currency-lens${path}`,
    );
    vi.stubGlobal("browser", { runtime: { getURL } });
    const extensionRender = render(<CurrencyIcon currencyCode="JPY" />);

    expect(getURL).toHaveBeenCalledWith("/currency-flags/jp.svg");
    expect(extensionRender.container.querySelector("img")?.getAttribute("src")).toBe(
      "moz-extension://currency-lens/currency-flags/jp.svg",
    );
    extensionRender.unmount();
    vi.unstubAllGlobals();

    const previewRender = render(<CurrencyIcon currencyCode="JPY" />);
    expect(previewRender.container.querySelector("img")?.getAttribute("src")).toBe(
      "/4x3/jp.svg",
    );
  });
});
