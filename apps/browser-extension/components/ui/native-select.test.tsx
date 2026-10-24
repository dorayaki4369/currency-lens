// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

afterEach(cleanup);

describe("NativeSelect", () => {
  it("forwards native selection behavior to its options", () => {
    const onChange = vi.fn<() => void>();
    render(
      <NativeSelect aria-label="Theme" defaultValue="system" onChange={onChange}>
        <NativeSelectOption value="system">System</NativeSelectOption>
        <NativeSelectOption value="dark">Dark</NativeSelectOption>
      </NativeSelect>,
    );

    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveProperty("value", "system");
    fireEvent.change(select, { target: { value: "dark" } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(select).toHaveProperty("value", "dark");
  });
});
