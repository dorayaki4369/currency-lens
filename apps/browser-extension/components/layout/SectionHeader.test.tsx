// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SectionHeader } from "@/components/layout/SectionHeader";

afterEach(cleanup);

describe("SectionHeader", () => {
  it("renders both heading levels and optional supporting content", () => {
    const { rerender } = render(
      <SectionHeader
        action={<button type="button">Edit</button>}
        description="Choose the currencies to display."
        id="targets-heading"
        title="Converted"
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Converted" }).id).toBe(
      "targets-heading",
    );
    expect(screen.getByText("Choose the currencies to display.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();

    rerender(<SectionHeader headingLevel={3} id="source-heading" title="Original" />);

    expect(screen.getByRole("heading", { level: 3, name: "Original" })).toBeDefined();
    expect(screen.queryByText("Choose the currencies to display.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
