// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it("supports native button behavior and child composition", () => {
    const onClick = vi.fn<() => void>();
    render(
      <>
        <Button onClick={onClick}>Save</Button>
        <Button asChild size="xs" variant="link">
          <a href="#settings">Settings</a>
        </Button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
      "#settings",
    );
  });
});
