// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyIdentity } from "@/components/currency/CurrencyIdentity";

afterEach(cleanup);

describe("CurrencyIdentity", () => {
  it("renders the icon, ISO code, and supplied description as one identity", () => {
    const getURL = vi.fn<(path: string) => string>((path) => `extension://${path}`);
    vi.stubGlobal("browser", { runtime: { getURL } });

    render(<CurrencyIdentity currencyCode="JPY" description={<span>Japanese yen</span>} />);

    expect(screen.getByText("JPY")).toBeDefined();
    expect(screen.getByText("Japanese yen")).toBeDefined();
    expect(document.querySelector('[data-currency-icon="JPY"]')).not.toBeNull();
  });

  it("keeps a supplied badge with the code when used inside a selection button", () => {
    render(
      <button type="button">
        <CurrencyIdentity
          currencyCode="JPY"
          description="Japanese yen"
          badge={<span>Default</span>}
        />
      </button>,
    );

    expect(screen.getByRole("button").textContent).toBe("JPYDefaultJapanese yen");
    expect(screen.getByText("Default").closest("button")).not.toBeNull();
  });
});
