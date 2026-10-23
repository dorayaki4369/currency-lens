// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

afterEach(cleanup);

describe("Badge", () => {
  it("renders directly or delegates to its supplied child", () => {
    render(
      <>
        <Badge>Default</Badge>
        <Badge asChild variant="outline">
          <a href="#status">Linked status</a>
        </Badge>
      </>,
    );

    expect(screen.getByText("Default").tagName).toBe("SPAN");
    expect(screen.getByRole("link", { name: "Linked status" }).getAttribute("href")).toBe(
      "#status",
    );
  });
});
