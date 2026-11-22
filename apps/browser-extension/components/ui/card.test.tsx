// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "@/components/ui/card";

afterEach(cleanup);

describe("Card", () => {
  it("insets its content one 8px unit on every side unless rows pad themselves", () => {
    render(
      <>
        <Card aria-label="Settings card">
          <p>Theme controls</p>
        </Card>
        <Card aria-label="Rows card" spacing="flush" />
      </>,
    );

    const card = screen.getByLabelText("Settings card");
    expect(card.textContent).toBe("Theme controls");
    expect(card.className).toContain("p-inset");
    expect(screen.getByLabelText("Rows card").className).not.toContain("p-inset");
  });
});
