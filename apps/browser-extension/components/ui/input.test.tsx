// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";

afterEach(cleanup);

describe("Input", () => {
  it("forwards native input value and change behavior", () => {
    const onChange = vi.fn<() => void>();
    render(<Input aria-label="Amount" onChange={onChange} type="number" value="10" />);

    const input = screen.getByRole("spinbutton", { name: "Amount" });
    expect(input).toHaveProperty("value", "10");
    fireEvent.change(input, { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});
