// @vitest-environment happy-dom

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";

const referenceMode = vi.hoisted(() => ({ content: true, trigger: true }));

vi.mock("@/components/ui/button", () => ({
  Button: ({ ref, ...props }: ComponentPropsWithRef<"button">) => (
    <button {...props} ref={referenceMode.trigger ? ref : undefined} />
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { readonly children?: ReactNode }) => <>{children}</>,
  PopoverContent: ({
    align: _align,
    avoidCollisions: _avoidCollisions,
    onCloseAutoFocus: _onCloseAutoFocus,
    portalled: _portalled,
    ref,
    side: _side,
    ...props
  }: ComponentPropsWithRef<"div"> & {
    readonly align?: string | undefined;
    readonly avoidCollisions?: boolean | undefined;
    readonly onCloseAutoFocus?: ((event: Event) => void) | undefined;
    readonly portalled?: boolean | undefined;
    readonly side?: string | undefined;
  }) => <div {...props} ref={referenceMode.content ? ref : undefined} />,
  PopoverTrigger: ({ children }: { readonly children?: ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  referenceMode.content = true;
  referenceMode.trigger = true;
});

describe("CurrencyCombobox reference guards", () => {
  it("leaves an open picker stable when its trigger reference is unavailable", () => {
    referenceMode.trigger = false;

    renderOpenCombobox();

    expect(screen.getByRole("listbox")).toBeDefined();
  });

  it("ignores root pointer dismissal while its content reference is unavailable", () => {
    referenceMode.content = false;
    const onOpenChange = vi.fn<(open: boolean) => void>();
    renderOpenCombobox(onOpenChange);

    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeDefined();
  });
});

/** Renders only the reference-sensitive open state with lightweight primitives. */
function renderOpenCombobox(onOpenChange?: (open: boolean) => void): void {
  render(
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
    />,
  );
}
