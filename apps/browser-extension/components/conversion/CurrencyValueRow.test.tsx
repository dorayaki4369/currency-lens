// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CurrencyValueRow } from "@/components/conversion/CurrencyValueRow";

afterEach(cleanup);

describe("CurrencyValueRow", () => {
  it("switches the shared row between display and edit layouts", () => {
    const { rerender } = render(
      <CurrencyValueRow
        amount={<span>150.00</span>}
        identity={<span>JPY</span>}
        currencyCode="JPY"
        mode="display"
      />,
    );

    const row = document.querySelector('[data-slot="currency-value-row"]');
    expect(row?.getAttribute("data-mode")).toBe("display");
    expect(readValueColumnOrder()).toEqual(["currency-identity", "currency-amount"]);

    rerender(
      <CurrencyValueRow
        amount={<span>1.00</span>}
        identity={<span>USD</span>}
        currencyCode="USD"
        mode="edit"
      />,
    );

    expect(row?.getAttribute("data-mode")).toBe("edit");
    expect(readValueColumnOrder()).toEqual(["currency-identity", "currency-amount"]);
  });

  it("places leading and trailing actions around the value content", () => {
    render(
      <CurrencyValueRow
        amount={<span>150.00</span>}
        identity={<span>JPY</span>}
        currencyCode="JPY"
        leadingAction={<button type="button">Reorder</button>}
        mode="display"
        trailingAction={<button type="button">Remove</button>}
      />,
    );

    const row = document.querySelector('[data-slot="currency-value-row"]');
    expect(row?.getAttribute("data-has-actions")).toBe("true");
    expect(row?.getAttribute("data-has-leading-action")).toBe("true");
    expect(row?.getAttribute("data-has-trailing-action")).toBe("true");
    expect(readSlotOrder(row)).toEqual([
      "currency-leading-action",
      "currency-value-content",
      "currency-trailing-action",
    ]);
  });

  it("does not reserve action space for boolean content that React omits", () => {
    render(
      <CurrencyValueRow
        amount={<span>150.00</span>}
        identity={<span>JPY</span>}
        currencyCode="JPY"
        leadingAction={false}
        mode="display"
        trailingAction
      />,
    );

    const row = document.querySelector('[data-slot="currency-value-row"]');
    expect(row?.hasAttribute("data-has-actions")).toBe(false);
    expect(row?.hasAttribute("data-has-leading-action")).toBe(false);
    expect(row?.hasAttribute("data-has-trailing-action")).toBe(false);
    expect(readSlotOrder(row)).toEqual(["currency-value-content"]);
  });
});

/** Reads semantic value columns without depending on generated class names. */
function readValueColumnOrder(): Array<string | null> {
  const content = document.querySelector('[data-slot="currency-value-content"]');
  return readSlotOrder(content);
}

/** Reads the direct child slots from one rendered row or content container. */
function readSlotOrder(element: Element | null): Array<string | null> {
  return [...(element?.children ?? [])].map((child) => child.getAttribute("data-slot"));
}
