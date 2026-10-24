// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";

afterEach(cleanup);

describe("RateTimestamp", () => {
  it("uses the same timestamp as plain metadata or a stale-rate warning", () => {
    const sourceTimestamp = Date.UTC(2026, 7, 28, 13);
    const { rerender } = render(
      <RateTimestamp isStale={false} locale="en" sourceTimestamp={sourceTimestamp} />,
    );

    expect(screen.getByText(/^Rates from /u)).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/24 hours/u)).toBeNull();

    rerender(<RateTimestamp isStale locale="en" sourceTimestamp={sourceTimestamp} />);

    expect(screen.getByRole("status").textContent).toContain("at least 24 hours old");
    expect(screen.getByText(/^Rates from /u)).toBeDefined();
  });
});
