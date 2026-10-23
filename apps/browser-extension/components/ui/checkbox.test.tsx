// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "@/components/ui/checkbox";

afterEach(cleanup);

describe("Checkbox", () => {
  it("exposes checked state and reports a user toggle", () => {
    const onCheckedChange = vi.fn<(checked: boolean | "indeterminate") => void>();
    render(
      <Checkbox
        aria-label="Receive rate updates"
        defaultChecked
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Receive rate updates" });
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
