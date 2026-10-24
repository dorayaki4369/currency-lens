// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Brand } from "@/components/layout/Brand";

afterEach(cleanup);

describe("Brand", () => {
  it("renders the product title with an optional eyebrow", () => {
    const { rerender } = render(<Brand title="Currency Lens" />);

    expect(screen.getByRole("heading", { level: 1, name: "Currency Lens" })).toBeDefined();
    expect(screen.getByRole("presentation").tagName).toBe("IMG");
    expect(screen.queryByText("Browser extension")).toBeNull();

    rerender(<Brand eyebrow="Browser extension" title="Currency Lens" />);

    expect(screen.getByText("Browser extension")).toBeDefined();
  });
});
