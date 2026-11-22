// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardContent } from "@/components/ui/card";

afterEach(cleanup);

describe("Card", () => {
  it("contains its content without changing the supplied semantics", () => {
    render(
      <Card aria-label="Settings card">
        <CardContent>
          <p>Theme controls</p>
        </CardContent>
      </Card>,
    );

    expect(screen.getByLabelText("Settings card").textContent).toContain("Theme controls");
  });

  it("insets a panel's blocks on every side", () => {
    render(<Card aria-label="Rates card" spacing="panel" />);

    expect(screen.getByLabelText("Rates card").className).toContain(
      "px-(--card-padding-x)",
    );
  });
});
