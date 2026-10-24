// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

afterEach(cleanup);

describe("Popover", () => {
  it("renders controlled content beside its trigger when portalling is disabled", () => {
    render(
      <Popover open>
        <PopoverTrigger>Choose</PopoverTrigger>
        <PopoverContent aria-label="Currency choices" portalled={false}>
          USD
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByRole("button", { name: "Choose" })).toBeDefined();
    expect(screen.getByLabelText("Currency choices").textContent).toBe("USD");
  });
});
