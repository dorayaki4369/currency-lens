// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RatesScreenSwitch,
  type RatesScreenView,
} from "@/components/rates/RatesScreenSwitch";
import { RateHistoryProvider, useRateHistoryStore } from "@/stores/rate-history";

afterEach(cleanup);

/** Chooses one currency and shows the stored selection. */
function StoredSelection() {
  const selection = useRateHistoryStore((state) => state.selection);
  const setSelection = useRateHistoryStore((state) => state.setSelection);
  return (
    <button onClick={() => setSelection("JPY")} type="button">
      {selection}
    </button>
  );
}

describe("RatesScreenSwitch", () => {
  it("switches screens and shows every target when the rates open from it", () => {
    const onValueChange = vi.fn<(view: RatesScreenView) => void>();
    const checkedItem = createRef<HTMLButtonElement>();
    render(
      <RateHistoryProvider>
        <RatesScreenSwitch
          checkedItemRef={checkedItem}
          locale="en"
          onValueChange={onValueChange}
          value="converter"
        />
        <StoredSelection />
      </RateHistoryProvider>,
    );

    const group = screen.getByRole("radiogroup", { name: "Screen" });
    expect(group.dataset["size"]).toBe("lg");
    const convert = screen.getByRole("radio", { name: "Convert" });
    expect(convert.getAttribute("aria-checked")).toBe("true");
    expect(checkedItem.current).toBe(convert);

    fireEvent.click(screen.getByRole("button", { name: "*" }));
    expect(screen.getByRole("button", { name: "JPY" })).toBeDefined();
    fireEvent.click(screen.getByRole("radio", { name: "Rates" }));
    expect(onValueChange).toHaveBeenCalledWith("rates");
    expect(screen.getByRole("button", { name: "*" })).toBeDefined();
  });
});
