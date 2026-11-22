// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "@/components/ui/card";

afterEach(cleanup);

describe("Card", () => {
  it("insets its content 8px on every side unless rows pad themselves", () => {
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
    expect(card.className.split(" ")).toContain("p-2");
    expect(screen.getByLabelText("Rows card").className.split(" ")).not.toContain("p-2");
  });

  it("lifts an overlay card off the host page with the page fill", () => {
    render(
      <>
        <Card aria-label="Raised card" />
        <Card aria-label="Overlay card" layer="overlay" />
      </>,
    );

    expect(screen.getByLabelText("Raised card").dataset["layer"]).toBe("raised");
    expect(screen.getByLabelText("Raised card").className).toContain("bg-card");
    const overlay = screen.getByLabelText("Overlay card");
    expect(overlay.dataset["layer"]).toBe("overlay");
    expect(overlay.className).toContain("bg-background");
    expect(overlay.className).not.toContain("bg-card");
  });
});
