// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Label } from "@/components/ui/label";

afterEach(cleanup);

describe("Label", () => {
  it("provides an accessible name to its associated control", () => {
    render(
      <>
        <Label htmlFor="amount">Amount</Label>
        <input id="amount" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Amount" })).toBeDefined();
  });
});
