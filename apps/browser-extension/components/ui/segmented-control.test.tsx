// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "@/components/ui/segmented-control";

afterEach(cleanup);

const OPTIONS = [
  { label: "Convert", value: "converter" },
  { label: "Rates", value: "rates" },
] as const;

describe("SegmentedControl", () => {
  it("marks the selected option as pressed and reports other choices", () => {
    const onValueChange = vi.fn<(value: string) => void>();
    const selectedButtonRef = createRef<HTMLButtonElement>();
    render(
      <SegmentedControl
        label="Screen"
        onValueChange={onValueChange}
        options={OPTIONS}
        selectedButtonRef={selectedButtonRef}
        value="converter"
      />,
    );

    const group = screen.getByRole("group", { name: "Screen" });
    expect(group.dataset["variant"]).toBe("screen");
    const convert = screen.getByRole("button", { name: "Convert" });
    expect(convert.getAttribute("aria-pressed")).toBe("true");
    expect(selectedButtonRef.current).toBe(convert);
    expect(screen.getByRole("button", { name: "Rates" }).getAttribute("aria-pressed")).toBe(
      "false",
    );

    fireEvent.click(convert);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rates" }));
    expect(onValueChange).toHaveBeenCalledWith("rates");
  });

  it.each(["compact", "pill"] as const)("renders the %s variant", (variant) => {
    render(
      <SegmentedControl
        className="mr-1"
        label="Period"
        onValueChange={() => undefined}
        options={OPTIONS}
        value="rates"
        variant={variant}
      />,
    );
    const group = screen.getByRole("group", { name: "Period" });
    expect(group.dataset["variant"]).toBe(variant);
    expect(group.className).toContain("mr-1");
  });
});
