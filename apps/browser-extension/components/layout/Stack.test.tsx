// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Stack } from "@/components/layout/Stack";

afterEach(cleanup);

describe("Stack", () => {
  it("preserves the selected semantic element and child order", () => {
    render(
      <Stack as="nav" aria-label="Settings">
        <a href="#appearance">Appearance</a>
        <a href="#currencies">Currencies</a>
      </Stack>,
    );

    const navigation = screen.getByRole("navigation", { name: "Settings" });
    expect([...navigation.children].map((child) => child.textContent)).toEqual([
      "Appearance",
      "Currencies",
    ]);
  });
});
