// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingIcon } from "@/entrypoints/content/components/FloatingIcon";

afterEach(() => {
  cleanup();
});

describe("FloatingIcon", () => {
  it("preserves the host-page selection while opening the lens", () => {
    const onClick = vi.fn<() => void>();
    render(
      <FloatingIcon
        floatingStyles={{ transform: "translate(120px, 48px)" }}
        locale="en"
        onClick={onClick}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Convert selected price",
    });

    expect(trigger.style.transform).toBe("translate(120px, 48px)");
    expect(trigger.lang).toBe("en");
    expect(trigger.querySelector("img")?.alt).toBe("");
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(fireEvent.mouseDown(trigger)).toBe(false);
    fireEvent.click(trigger);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows the flag, converted amount, and an arrow for the top conversion", () => {
    const onClick = vi.fn<() => void>();
    render(
      <FloatingIcon
        floatingStyles={{ transform: "translate(120px, 48px)" }}
        locale="ja"
        onClick={onClick}
        quickConversion={{
          amount: { text: "￥6,962", value: 6962 },
          currencyCode: "JPY",
          pending: false,
        }}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "￥6,962（日本円）。すべての換算先を表示",
    });

    expect(trigger.style.transform).toBe("translate(120px, 48px)");
    expect(readAmountLabel(trigger)).toBe("￥6,962");
    expect(readAmountDirection(trigger)).toBe("up");
    expect(trigger.querySelector('[data-currency-icon="JPY"]')).not.toBeNull();
    expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(trigger.querySelector('[data-slot="app-logo"]')).toBeNull();
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(fireEvent.mouseDown(trigger)).toBe(false);
    fireEvent.click(trigger);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps keyboard focus when the logo turns into the amount and back", () => {
    const props = {
      floatingStyles: {},
      locale: "en" as const,
      onClick: vi.fn<() => void>(),
      setFloating: vi.fn<(element: HTMLElement | null) => void>(),
    };
    const { rerender } = render(<FloatingIcon {...props} quickConversion={null} />);
    const trigger = screen.getByRole("button", { name: "Convert selected price" });
    trigger.focus();

    rerender(
      <FloatingIcon
        {...props}
        quickConversion={{
          amount: { text: "¥6,962", value: 6962 },
          currencyCode: "JPY",
          pending: false,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /Show all conversions$/u })).toBe(trigger);
    expect(document.activeElement).toBe(trigger);

    rerender(<FloatingIcon {...props} quickConversion={null} />);
    expect(screen.getByRole("button", { name: "Convert selected price" })).toBe(trigger);
    expect(document.activeElement).toBe(trigger);
  });

  it("announces a held amount as converting and keeps it still", () => {
    render(
      <FloatingIcon
        floatingStyles={{}}
        locale="en"
        onClick={vi.fn<() => void>()}
        quickConversion={{
          amount: { text: "¥6,962", value: 6962 },
          currencyCode: "JPY",
          pending: true,
        }}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Converting currency" });

    expect(trigger.getAttribute("aria-busy")).toBe("true");
    expect(readAmountLabel(trigger)).toBe("¥6,962");
    expect(readAmountDirection(trigger)).toBeUndefined();
  });
});

/** Reads the amount text kept for assistive technology inside the rolling glyphs. */
function readAmountLabel(trigger: HTMLElement): string | null | undefined {
  return trigger.querySelector('[data-slot="animated-number-label"]')?.textContent;
}

/** Reads which way the amount is currently rolling. */
function readAmountDirection(trigger: HTMLElement): string | undefined {
  return trigger.querySelector<HTMLElement>('[data-slot="animated-number"]')?.dataset[
    "direction"
  ];
}
