// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sparkline } from "@/components/rates/Sparkline";

afterEach(cleanup);

describe("Sparkline", () => {
  it("draws a line over a fading area and opens the chart when activated", () => {
    const onOpen = vi.fn<() => void>();
    render(
      <Sparkline
        color="var(--trend-red-line)"
        label="Open JPY rates"
        onOpen={onOpen}
        values={[150, 151, null, 149, 152]}
      />,
    );

    const button = screen.getByRole("button", { name: "Open JPY rates" });
    const paths = button.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    const gradientId = button.querySelector("linearGradient")?.id;
    expect(gradientId).toMatch(/^sparkline-[\w-]+$/u);
    expect(paths[0]?.getAttribute("fill")).toBe(`url(#${gradientId ?? ""})`);
    expect(paths[1]?.style.stroke).toBe("var(--trend-red-line)");
    expect(paths[1]?.getAttribute("d")?.match(/M/gu)).toHaveLength(2);

    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps a dashed placeholder when there is no history", () => {
    render(
      <Sparkline color="red" label="Open EUR rates" onOpen={() => undefined} values={[]} />,
    );
    const button = screen.getByRole("button", { name: "Open EUR rates" });
    expect(button.querySelector('[data-slot="sparkline-placeholder"]')).not.toBeNull();
    expect(button.querySelector("path")).toBeNull();
  });
});
