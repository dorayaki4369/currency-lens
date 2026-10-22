// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconButton } from "@/components/ui/icon-button";

afterEach(cleanup);

describe("icon button", () => {
  it("provides an accessible name without adding a tooltip", () => {
    const onClick = vi.fn<() => void>();
    render(
      <IconButton label="Open settings" onClick={onClick}>
        <Settings aria-hidden="true" />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Open settings" });
    fireEvent.focus(button);
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
