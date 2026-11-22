// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SegmentedControl,
  SegmentedControlItem,
  selectSegmentedOption,
} from "@/components/ui/segmented-control";

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

  it("moves focus and selection between options with horizontal arrow keys", async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <SegmentedControl
        aria-label="Theme"
        defaultValue="system"
        onValueChange={onValueChange}
      >
        <SegmentedControlItem value="system">System</SegmentedControlItem>
        <SegmentedControlItem value="light">Light</SegmentedControlItem>
        <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
      </SegmentedControl>,
    );
    const system = screen.getByRole("radio", { name: "System" });
    const light = screen.getByRole("radio", { name: "Light" });

    // Tab stops on the group, which hands focus to the current choice.
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group.tabIndex).toBe(0);
    group.focus();
    await waitFor(() => expect(document.activeElement).toBe(system));

    fireEvent.keyDown(system, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(light));
    expect(light.getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenLastCalledWith("light");

    fireEvent.keyDown(light, { key: "ArrowLeft" });
    await waitFor(() => expect(document.activeElement).toBe(system));
    expect(system.getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenLastCalledWith("system");
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

  it("keeps the theme toggle's look by default and offers smaller and pill-shaped styles", () => {
    const { rerender } = render(
      <SegmentedControl aria-label="Screen" defaultValue="a">
        <SegmentedControlItem value="a">A</SegmentedControlItem>
      </SegmentedControl>,
    );
    const group = screen.getByRole("radiogroup", { name: "Screen" });
    const item = screen.getByRole("radio", { name: "A" });
    const thumb = group.querySelector('[data-slot="segmented-control-thumb"]');
    expect([group.dataset["size"], group.dataset["variant"]]).toEqual(["default", "track"]);
    expect(group.className).toContain("h-8");
    expect(group.className).toContain("bg-muted");
    expect(item.className).toContain("font-medium");
    expect(thumb?.className).toContain("shadow-sm");

    rerender(
      <SegmentedControl aria-label="Screen" defaultValue="a" size="sm">
        <SegmentedControlItem value="a">A</SegmentedControlItem>
      </SegmentedControl>,
    );
    expect(group.className).toContain("h-7");
    expect(group.className).toContain("inline-flex");
    expect(item.className).toContain("font-semibold");

    rerender(
      <SegmentedControl aria-label="Screen" defaultValue="a" surface="page">
        <SegmentedControlItem value="a">A</SegmentedControlItem>
      </SegmentedControl>,
    );
    // On the muted page background the track takes a deeper fill.
    expect(group.className).toContain("bg-zinc-200");
    expect(group.className).not.toContain("bg-muted");

    rerender(
      <SegmentedControl
        aria-label="Screen"
        defaultValue="a"
        size="sm"
        stretch
        variant="pill"
      >
        <SegmentedControlItem value="a">A</SegmentedControlItem>
      </SegmentedControl>,
    );
    // Pills keep a lighter type than the size's and share its 28px height.
    expect(group.className).toContain("h-7");
    expect(group.className).toContain("w-full");
    expect(group.className).not.toContain("inline-flex");
    expect(item.className).toContain("font-medium");
    expect(item.className).not.toContain(" font-semibold");

    rerender(
      <SegmentedControl aria-label="Screen" defaultValue="a" size="lg" variant="pill">
        <SegmentedControlItem value="a">A</SegmentedControlItem>
      </SegmentedControl>,
    );
    expect(group.dataset["variant"]).toBe("pill");
    expect(group.className).not.toContain("bg-muted");
    expect(item.className).toContain("rounded-full");
    expect(item.className).toContain("text-sm");
    expect(thumb?.className).toContain("rounded-full");
    expect(thumb?.className).toContain("top-0.5");
    expect(thumb?.className).toContain("motion-safe:transition-[translate,width]");
  });

  it("passes on only values that belong to the typed options", () => {
    const onSelect = vi.fn<(value: "a" | "b") => void>();
    const select = selectSegmentedOption(["a", "b"] as const, onSelect);
    select("b");
    select("c");
    expect(onSelect.mock.calls).toEqual([["b"]]);
  });
});
