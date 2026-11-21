// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";

afterEach(cleanup);

describe("RateTimestamp", () => {
  it("uses the same timestamp as plain metadata or a stale-rate warning", () => {
    const sourceTimestamp = Date.UTC(2026, 7, 28, 13);
    const formatted = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(sourceTimestamp);
    const { container, rerender } = render(
      <RateTimestamp isStale={false} locale="en" sourceTimestamp={sourceTimestamp} />,
    );

    const time = container.querySelector("time");
    expect(time?.textContent).toBe(formatted);
    expect(time?.getAttribute("datetime")).toBe("2026-08-28T13:00:00.000Z");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/24 hours/u)).toBeNull();

    rerender(<RateTimestamp isStale locale="en" sourceTimestamp={sourceTimestamp} />);

    expect(screen.getByRole("status").textContent).toContain("at least 24 hours old");
    expect(container.querySelector("time")?.textContent).toBe(formatted);
  });

  it("links the rate provider in a new tab without leaking the opener", () => {
    render(
      <RateTimestamp isStale={false} locale="ja" sourceTimestamp={Date.UTC(2026, 7, 28)} />,
    );

    const link = screen.getByRole("link", { name: "Open Exchange Rates" });
    expect(link.getAttribute("href")).toBe("https://openexchangerates.org/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
