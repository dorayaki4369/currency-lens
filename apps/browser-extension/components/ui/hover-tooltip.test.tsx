// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Settings } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { IconButton } from "@/components/ui/icon-button";

afterEach(cleanup);

describe("hover tooltip", () => {
  it("opens only while its explicitly wrapped target is hovered", async () => {
    render(
      <HoverTooltip content="Open settings" portalled={false}>
        <IconButton label="Open settings">
          <Settings aria-hidden="true" />
        </IconButton>
      </HoverTooltip>,
    );

    const button = screen.getByRole("button", { name: "Open settings" });
    fireEvent.focus(button);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(button);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Open settings");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());

    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(button);
    expect(await screen.findByRole("tooltip")).toBeDefined();
    fireEvent.mouseLeave(button);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});
