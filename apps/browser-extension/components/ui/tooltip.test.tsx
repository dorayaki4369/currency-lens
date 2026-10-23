// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

afterEach(cleanup);

describe("Tooltip", () => {
  it("renders controlled content for an explicitly wrapped target", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button type="button">Settings</button>
          </TooltipTrigger>
          <TooltipContent portalled={false}>Open settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeDefined();
    expect(screen.getByRole("tooltip").textContent).toContain("Open settings");
  });
});
