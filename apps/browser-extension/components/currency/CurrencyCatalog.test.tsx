// @vitest-environment happy-dom

import { currencies } from "@cl/currency";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compareCurrencyCodes } from "@/lib/currency-order";
import { CurrencyCatalog } from "@/components/currency/CurrencyCatalog";

afterEach(cleanup);

describe("CurrencyCatalog", () => {
  it("filters the read-only catalog by code and exposes its heading relationship", () => {
    vi.stubGlobal("browser", {
      runtime: { getURL: (path: string) => `extension://${path}` },
    });
    render(<CurrencyCatalog headingId="catalog-heading" locale="en" />);

    const list = screen.getByRole("list");
    expect(list.getAttribute("aria-labelledby")).toBe("catalog-heading");
    expect(list.tabIndex).toBe(0);
    const listItems = within(list).getAllByRole("listitem");
    expect(listItems).toHaveLength(currencies.length);
    const renderedCodes = listItems.map(
      (listItem) => listItem.querySelector("strong")?.textContent,
    );
    expect(renderedCodes).toEqual(
      currencies.map((currency) => currency.code).toSorted(compareCurrencyCodes),
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search currencies" }), {
      target: { value: "JPY" },
    });

    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("JPY")).toBeDefined();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search currencies" }), {
      target: { value: "no-such-currency" },
    });
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("keeps region search without rendering region names in catalog rows", () => {
    vi.stubGlobal("browser", {
      runtime: { getURL: (path: string) => `extension://${path}` },
    });
    render(<CurrencyCatalog headingId="catalog-heading" locale="en" />);

    const list = screen.getByRole("list");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search currencies" }), {
      target: { value: "Japan" },
    });

    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("JPY")).toBeDefined();
    expect(within(list).queryByText("Japan")).toBeNull();
  });
});
