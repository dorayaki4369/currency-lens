// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";

afterEach(cleanup);

describe("CurrencyCombobox", () => {
  it("orders supplied candidates by ISO code without mutating the caller's list", () => {
    const currencyCodes = ["USD", "AED", "JPY"] as const;
    render(
      <CurrencyCombobox
        ariaLabel="Currency"
        currencyCodes={currencyCodes}
        defaultOpen
        locale="en"
        onValueChange={() => undefined}
        placeholder="Choose a currency"
        portalled={false}
        value="USD"
      />,
    );

    expect(
      screen.getAllByRole("option").map((option) => option.textContent?.slice(0, 3)),
    ).toEqual(["AED", "JPY", "USD"]);
    expect(screen.getByRole("dialog", { name: "Search currencies" })).toBeDefined();
    expect(currencyCodes).toEqual(["USD", "AED", "JPY"]);
  });

  it("searches direct options, reports selection, and closes", () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const onValueChange = vi.fn<(currencyCode: CurrencyCode) => void>();
    vi.stubGlobal("browser", {
      runtime: { getURL: (path: string) => `extension://${path}` },
    });
    render(
      <CurrencyCombobox
        ariaLabel="Currency"
        badge={{ currencyCode: "JPY", label: "Default" }}
        currencyCodes={["JPY", "USD"]}
        defaultOpen
        locale="en"
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
        placeholder="Choose a currency"
        portalled={false}
        value="JPY"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain(
      "Default",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Search currencies" }), {
      target: { value: "USD" },
    });
    fireEvent.click(screen.getByRole("option", { name: /^USD\b/u }));

    expect(onValueChange).toHaveBeenCalledWith("USD");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("option", { name: /^USD\b/u })).toBeNull();
  });

  it("renders a disabled placeholder without opening options", () => {
    render(
      <CurrencyCombobox
        ariaLabel="Currency"
        disabled
        locale="en"
        nullValueLabel="No currency"
        onValueChange={() => undefined}
        placeholder="Choose a currency"
        value={null}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Currency" });
    expect(trigger.textContent).toContain("No currency");
    expect(trigger).toHaveProperty("disabled", true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps pointer interactions inside an open picker and dismisses from its root", () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(
      <>
        <button type="button">Outside</button>
        <CurrencyCombobox
          ariaLabel="Currency"
          currencyCodes={["JPY", "USD"]}
          defaultOpen
          locale="en"
          onOpenChange={onOpenChange}
          onValueChange={() => undefined}
          placeholder="Choose a currency"
          portalled={false}
          value="JPY"
        />
      </>,
    );

    fireEvent.pointerDown(screen.getByRole("combobox", { name: "Currency" }));
    expect(screen.getByRole("listbox")).toBeDefined();
    fireEvent.pointerDown(screen.getByRole("combobox", { name: "Search currencies" }));
    expect(screen.getByRole("listbox")).toBeDefined();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("repeats dismissal requests while a controlled picker remains open", () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(
      <>
        <button type="button">Outside</button>
        <CurrencyCombobox
          ariaLabel="Currency"
          currencyCodes={["JPY", "USD"]}
          locale="en"
          onOpenChange={onOpenChange}
          onValueChange={() => undefined}
          open
          placeholder="Choose a currency"
          portalled={false}
          value="JPY"
        />
      </>,
    );

    const outside = screen.getByRole("button", { name: "Outside" });
    fireEvent.pointerDown(outside);
    fireEvent.pointerUp(outside);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.pointerDown(outside);

    expect(screen.getByRole("listbox")).toBeDefined();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
