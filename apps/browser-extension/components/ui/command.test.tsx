// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

afterEach(cleanup);

describe("Command", () => {
  it("filters direct items and reports a selected value", () => {
    const onSelect = vi.fn<(value: string) => void>();
    render(
      <Command label="Search currency">
        <CommandInput />
        <CommandList>
          <CommandEmpty>No currency found.</CommandEmpty>
          <CommandGroup>
            <CommandItem onSelect={onSelect} value="USD">
              USD
            </CommandItem>
            <CommandItem value="JPY">JPY</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    fireEvent.click(screen.getByRole("option", { name: "USD" }));
    expect(onSelect).toHaveBeenCalledWith("USD");

    fireEvent.change(screen.getByRole("combobox", { name: "Search currency" }), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No currency found.")).toBeDefined();
  });
});
