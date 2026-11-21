// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

afterEach(cleanup);

describe("SegmentedControl", () => {
  it("exposes its options as radios and reports the chosen value", () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <SegmentedControl
        aria-label="Theme"
        defaultValue="system"
        onValueChange={onValueChange}
      >
        <SegmentedControlItem value="system">System</SegmentedControlItem>
        <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
      </SegmentedControl>,
    );

    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeDefined();
    const system = screen.getByRole("radio", { name: "System" });
    const dark = screen.getByRole("radio", { name: "Dark" });
    expect(system.getAttribute("aria-checked")).toBe("true");
    expect(dark.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(dark);
    expect(onValueChange).toHaveBeenCalledWith("dark");
    expect(dark.getAttribute("aria-checked")).toBe("true");
  });

  it("slides the thumb to the checked option and hides it without a choice", async () => {
    const { container, unmount } = render(
      <SegmentedControl aria-label="Theme">
        <SegmentedControlItem value="system">System</SegmentedControlItem>
        <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
      </SegmentedControl>,
    );
    const thumb = container.querySelector<HTMLElement>(
      '[data-slot="segmented-control-thumb"]',
    );
    expect(thumb?.hidden).toBe(true);

    const dark = screen.getByRole("radio", { name: "Dark" });
    Object.defineProperty(dark, "offsetLeft", { configurable: true, value: 48 });
    Object.defineProperty(dark, "offsetWidth", { configurable: true, value: 40 });
    fireEvent.click(dark);

    await waitFor(() => expect(thumb?.hidden).toBe(false));
    expect(thumb?.style.translate).toBe("48px 0");
    expect(thumb?.style.width).toBe("40px");
    unmount();
  });
});
