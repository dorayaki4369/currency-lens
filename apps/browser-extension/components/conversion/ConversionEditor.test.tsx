// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps, StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConversionEditor,
  type ConversionTargetAmount,
} from "@/components/conversion/ConversionEditor";

afterEach(cleanup);

describe("ConversionEditor", () => {
  it("focuses the source amount on mount without reclaiming focus after an update", () => {
    const props = {
      amountText: "1",
      currencyCode: "USD",
      locale: "en",
      onAmountTextChange: () => undefined,
      onCurrencyChange: () => undefined,
      targetAmounts: new Map(),
      targetCurrencies: [],
      targetTitle: "Converted",
    } satisfies ComponentProps<typeof ConversionEditor>;
    const { rerender } = render(
      <StrictMode>
        <ConversionEditor {...props} />
      </StrictMode>,
    );
    expect(document.activeElement).toBe(screen.getByRole("spinbutton", { name: "Amount" }));

    const currency = screen.getByRole("combobox", { name: "Currency" });
    currency.focus();
    rerender(
      <StrictMode>
        <ConversionEditor {...props} amountText="2" />
      </StrictMode>,
    );
    expect(document.activeElement).toBe(currency);
  });

  it("announces all initially loading target amounts with one status", () => {
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={
          new Map([
            ["JPY", { status: "loading" }],
            ["EUR", { status: "loading" }],
          ])
        }
        targetCurrencies={["JPY", "EUR"]}
        targetTitle="Converted"
      />,
    );

    const targetSection = screen
      .getByRole("heading", { name: "Converted" })
      .closest("section");
    expect(targetSection?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("status", { name: "Converting currency" })).toHaveLength(1);
    expect(
      targetSection?.querySelectorAll('[data-slot="skeleton"][aria-hidden="true"]'),
    ).toHaveLength(2);
  });

  it("renders a standalone empty state when target editing is unavailable", () => {
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={new Map()}
        targetCurrencies={[]}
        targetTitle="Converted"
      />,
    );

    expect(screen.getByText("Add a currency to activate conversions.")).toBeDefined();
    expect(screen.queryByLabelText("Add a target")).toBeNull();
  });

  it("shows target management only while edit mode is active", async () => {
    const onAdd = vi.fn<(currencyCode: CurrencyCode) => void>();
    const onRemove = vi.fn<(currencyCode: CurrencyCode) => void>();

    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        onReorderTarget={() => undefined}
        targetAmounts={
          new Map([
            ["JPY", { status: "converted", text: "150.00", value: 150 }],
            ["EUR", { status: "converted", text: "0.92", value: 0.92 }],
          ])
        }
        targetCurrencies={["JPY", "EUR"]}
        targetEditing={{ onAdd, onRemove }}
        targetTitle="Converted"
      />,
    );

    expect(screen.getByRole("list", { name: "Conversion targets" })).toBeDefined();
    expect(screen.getByText("150.00")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Reorder /u })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove JPY" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Add a target" })).toBeNull();

    const sourceRow = screen
      .getByRole("heading", { name: "Original" })
      .closest("section")
      ?.querySelector('[data-slot="currency-value-row"]');
    const sourceAmount = sourceRow?.querySelector('[data-slot="currency-amount"]');
    if (
      sourceRow === null ||
      sourceRow === undefined ||
      sourceAmount === null ||
      sourceAmount === undefined
    ) {
      throw new TypeError("Expected the source currency value row");
    }
    const sourceAmountClassName = sourceAmount.className;

    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));

    const editableTargetList = screen.getByRole("list", { name: "Conversion targets" });
    expect(editableTargetList.getAttribute("data-draggable")).toBe("true");
    expect(editableTargetList.getAttribute("data-deletable")).toBe("true");
    const targetAdder = document.querySelector('[data-slot="target-add-row"]');
    const targetAdderClip = document.querySelector('[data-slot="target-add-clip"]');
    const targetAdderReveal = document.querySelector('[data-slot="target-add-reveal"]');
    expect(targetAdder).not.toBeNull();
    expect(targetAdderClip).not.toBeNull();
    expect(targetAdderReveal).not.toBeNull();
    expect(targetAdder?.parentElement).toBe(targetAdderClip);
    expect(targetAdderClip?.parentElement).toBe(targetAdderReveal);
    expect(editableTargetList.parentElement).toBe(targetAdderReveal?.parentElement);
    expect(editableTargetList.parentElement?.lastElementChild).toBe(targetAdderReveal);
    const addTargetSelect = screen.getByRole("combobox", { name: "Add a target" });
    expect(addTargetSelect.textContent).toContain("Add a target");
    fireEvent.click(addTargetSelect);
    const addTargetSearch = await screen.findByPlaceholderText("Code, name, or region");
    fireEvent.change(addTargetSearch, { target: { value: "GBP" } });
    fireEvent.click(await screen.findByRole("option", { name: /^GBP\b/u }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("GBP");
    expect(addTargetSelect.textContent).toContain("Add a target");
    const reorderButton = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 2",
    });
    const removeButton = screen.getByRole("button", { name: "Remove JPY" });
    const editableTargetRow = editableTargetList.querySelector(
      '[data-slot="currency-value-row"]',
    );
    const currencyIcon = editableTargetList.querySelector('[data-currency-icon="JPY"]');
    expect(currencyIcon).not.toBeNull();
    expect(reorderButton.contains(currencyIcon)).toBe(false);
    expect(sourceRow.querySelector('[data-slot="currency-leading-action"]')).toBeNull();
    expect(sourceRow.querySelector('[data-slot="currency-trailing-action"]')).toBeNull();
    expect(sourceRow.querySelector('[data-slot="currency-amount"]')).toBe(sourceAmount);
    expect(sourceAmount.className).toBe(sourceAmountClassName);
    expect(reorderButton.closest('[data-slot="currency-leading-action"]')).not.toBeNull();
    expect(removeButton.closest('[data-slot="currency-trailing-action"]')).not.toBeNull();
    expect(reorderButton.closest('[data-slot="currency-value-row"]')).toBe(
      editableTargetRow,
    );
    expect(removeButton.closest('[data-slot="currency-value-row"]')).toBe(
      editableTargetRow,
    );
    const animatedTargetRow = requireAnimatedTargetRow(removeButton);
    expect(screen.getByText("150.00")).toBeDefined();
    fireEvent.click(removeButton);
    expect(onRemove).not.toHaveBeenCalled();
    fireTransitionEnd(animatedTargetRow, "translate");
    expect(onRemove).toHaveBeenCalledWith("JPY");

    fireEvent.click(
      screen.getByRole("button", { name: "Finish editing conversion targets" }),
    );
    expect(document.querySelector('[data-target-editing-state="exiting"]')).not.toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Reorder /u })).toHaveLength(2);
    await waitFor(() => {
      expect(screen.queryAllByRole("button", { name: /^Reorder /u })).toHaveLength(0);
      expect(screen.queryByRole("button", { name: "Remove JPY" })).toBeNull();
      expect(screen.queryByRole("combobox", { name: "Add a target" })).toBeNull();
    });
    expect(screen.getByText("150.00")).toBeDefined();
  });

  it("disables removal when only one target remains", () => {
    const onRemove = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={new Map([["JPY", { status: "placeholder" }]])}
        targetCurrencies={["JPY"]}
        targetEditing={{ onAdd: () => undefined, onRemove }}
        targetTitle="Converted"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    const removeButton = screen.getByRole("button", { name: "Remove JPY" });
    expect(removeButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(removeButton);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("keeps the deleted row's amount stable until its exit finishes", () => {
    const onRemove = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(<StatefulDeletingConversionEditor onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    const removeButton = screen.getByRole("button", { name: "Remove JPY" });
    const animatedRow = requireAnimatedTargetRow(removeButton);

    fireEvent.click(removeButton);

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText("150.00")).toBeDefined();
    fireTransitionEnd(animatedRow, "translate");
    expect(onRemove).toHaveBeenCalledWith("JPY");
    expect(screen.queryByText("150.00")).toBeNull();
  });

  it("hides the target adder when the configured maximum is reached", () => {
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={new Map()}
        targetCurrencies={["JPY"]}
        targetEditing={{
          maximum: 1,
          onAdd: () => undefined,
          onRemove: () => undefined,
        }}
        targetTitle="Converted"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    expect(screen.queryByRole("combobox", { name: "Add a target" })).toBeNull();
  });

  it("keeps edit controls mounted until their exit transitions finish", async () => {
    const transition = Promise.withResolvers<void>();
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        onReorderTarget={() => undefined}
        targetAmounts={
          new Map([["JPY", { status: "converted", text: "150.00", value: 150 }]])
        }
        targetCurrencies={["JPY"]}
        targetEditing={{ onAdd: () => undefined, onRemove: () => undefined }}
        targetTitle="Converted"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    stubEditingTransitions(transition.promise);

    const finishButton = screen.getByRole("button", {
      name: "Finish editing conversion targets",
    });
    finishButton.focus();
    fireEvent.click(finishButton);

    expect(document.querySelector('[data-target-editing-state="exiting"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Reorder /u })).toBeDefined();
    expect(finishButton.getAttribute("aria-disabled")).toBe("true");
    expect(finishButton.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(finishButton);

    transition.resolve();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Reorder /u })).toBeNull();
    });
    expect(document.activeElement).toBe(finishButton);
  });

  it("ignores an old exit completion after editing is removed and reopened", async () => {
    const transition = Promise.withResolvers<void>();
    const editorProps = {
      amountText: "1",
      currencyCode: "USD" as const,
      locale: "en" as const,
      onAmountTextChange: () => undefined,
      onCurrencyChange: () => undefined,
      onReorderTarget: () => undefined,
      targetAmounts: new Map([
        ["JPY" as const, { status: "converted" as const, text: "150.00", value: 150 }],
      ]),
      targetCurrencies: ["JPY"] as const,
      targetTitle: "Converted",
    };
    const targetEditing = { onAdd: () => undefined, onRemove: () => undefined };
    const { rerender } = render(
      <ConversionEditor {...editorProps} targetEditing={targetEditing} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    stubEditingTransitions(transition.promise);
    fireEvent.click(
      screen.getByRole("button", { name: "Finish editing conversion targets" }),
    );

    rerender(<ConversionEditor {...editorProps} />);
    rerender(<ConversionEditor {...editorProps} targetEditing={targetEditing} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    expect(document.querySelector('[data-target-editing-state="active"]')).not.toBeNull();

    transition.resolve();
    await transition.promise;
    await Promise.resolve();

    expect(document.querySelector('[data-target-editing-state="active"]')).not.toBeNull();
  });

  it("keeps a fallback separate from target controls while edit mode is active", () => {
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={new Map()}
        targetCurrencies={[]}
        targetEditing={{ onAdd: () => undefined, onRemove: () => undefined }}
        targetFallback={<p>Rates are unavailable.</p>}
        targetTitle="Converted"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));

    expect(
      document.querySelector('[data-target-editing-motion="entering"]'),
    ).not.toBeNull();
    expect(screen.getByText("Rates are unavailable.")).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Add a target" })).toBeDefined();
    expect(screen.queryByRole("list", { name: "Conversion targets" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Finish editing conversion targets" }),
    );
    expect(document.querySelector('[data-target-editing-state="exiting"]')).not.toBeNull();
  });

  it("does not let a cancelled entrance frame reactivate target editing", () => {
    let entranceFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        entranceFrame = callback;
        return 1;
      });
    const cancelAnimationFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={new Map()}
        targetCurrencies={[]}
        targetEditing={{ onAdd: () => undefined, onRemove: () => undefined }}
        targetFallback={<p>Rates are unavailable.</p>}
        targetTitle="Converted"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Finish editing conversion targets" }),
    );
    act(() => entranceFrame?.(0));

    expect(document.querySelector('[data-target-editing-state="exiting"]')).not.toBeNull();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
  });

  it("keeps a converted amount visible without a skeleton while it refreshes", () => {
    const editorProps = {
      amountText: "1",
      currencyCode: "USD" as const,
      locale: "en" as const,
      onAmountTextChange: () => undefined,
      onCurrencyChange: () => undefined,
      targetCurrencies: ["JPY"] as const,
      targetTitle: "Converted",
    };
    const { rerender } = render(
      <ConversionEditor
        {...editorProps}
        targetAmounts={
          new Map([["JPY", { status: "converted", text: "150.00", value: 150 }]])
        }
      />,
    );
    const amount = document.querySelector<HTMLElement>(
      '[data-slot="currency-amount"] > strong',
    );
    if (amount === null) {
      throw new TypeError("Expected a converted amount");
    }
    const amountLabel = screen.getByText("150.00");
    const amountClassName = amount.className;

    rerender(
      <ConversionEditor
        {...editorProps}
        targetAmounts={new Map([["JPY", { status: "loading" }]])}
      />,
    );

    expect(screen.getByText("150.00")).toBe(amountLabel);
    expect(screen.getByRole("status", { name: "Converting currency" })).toBeDefined();
    expect(amount.getAttribute("aria-busy")).toBe("true");
    expect(
      amount.querySelector('[data-slot="animated-number"]')?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(amount.className).toBe(amountClassName);
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();

    rerender(
      <ConversionEditor
        {...editorProps}
        targetAmounts={
          new Map([["JPY", { status: "converted", text: "151.25", value: 151.25 }]])
        }
      />,
    );

    expect(screen.getByText("151.25")).toBe(amountLabel);
    expect(amount.getAttribute("aria-busy")).toBeNull();
    expect(screen.queryByRole("status", { name: "Converting currency" })).toBeNull();
    expect(
      amount.querySelector('[data-slot="animated-number"]')?.getAttribute("data-direction"),
    ).toBe("up");
  });

  it("compacts an exponential converted amount to keep it inside the result column", () => {
    render(
      <ConversionEditor
        amountText="1"
        currencyCode="USD"
        locale="en"
        onAmountTextChange={() => undefined}
        onCurrencyChange={() => undefined}
        targetAmounts={
          new Map([["JPY", { status: "converted", text: "1.23E+12", value: 1.23e12 }]])
        }
        targetCurrencies={["JPY"]}
        targetTitle="Converted"
      />,
    );

    expect(screen.getByText("1.23E+12").closest("strong")?.classList).toContain("text-xs");
  });
});

/** Creates the transition metadata that happy-dom omits from its event constructor. */
function fireTransitionEnd(element: HTMLElement, propertyName: string): void {
  const event = new Event("transitionend", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}

/** Returns the list-owned motion wrapper around one target action. */
function requireAnimatedTargetRow(action: HTMLElement): HTMLElement {
  const row = action.closest("li")?.querySelector('[data-slot="list-item-row"]');
  if (!(row instanceof HTMLElement)) {
    throw new TypeError("Expected the animated target row");
  }
  return row;
}

/** Removes target data when the list reports that its visual exit has completed. */
function StatefulDeletingConversionEditor({
  onRemove,
}: {
  readonly onRemove: (currencyCode: CurrencyCode) => void;
}) {
  const [targetCurrencies, setTargetCurrencies] = useState<readonly CurrencyCode[]>([
    "JPY",
    "EUR",
  ]);
  const knownAmounts: ReadonlyMap<CurrencyCode, ConversionTargetAmount> = new Map([
    ["JPY", { status: "converted", text: "150.00", value: 150 }],
    ["EUR", { status: "converted", text: "0.92", value: 0.92 }],
  ]);
  const targetAmounts = new Map(
    targetCurrencies.flatMap((currencyCode) => {
      const amount = knownAmounts.get(currencyCode);
      return amount === undefined ? [] : ([[currencyCode, amount]] as const);
    }),
  );

  return (
    <ConversionEditor
      amountText="1"
      currencyCode="USD"
      locale="en"
      onAmountTextChange={() => undefined}
      onCurrencyChange={() => undefined}
      targetAmounts={targetAmounts}
      targetCurrencies={targetCurrencies}
      targetEditing={{
        onAdd: () => undefined,
        onRemove: (currencyCode) => {
          onRemove(currencyCode);
          setTargetCurrencies((current) =>
            current.filter((candidate) => candidate !== currencyCode),
          );
        },
      }}
      targetTitle="Converted"
    />
  );
}

/** Gives each edit-motion element one controllable browser transition. */
function stubEditingTransitions(finished: Promise<void>): void {
  const animation = { finished } as unknown as Animation;
  const selector = [
    '[data-slot="currency-value-row"]',
    '[data-slot="currency-leading-action"]',
    '[data-slot="currency-trailing-action"]',
    '[data-slot="target-add-reveal"]',
    '[data-slot="target-add-row"]',
  ].join(",");
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    element.getAnimations = () => [animation];
  }
}
