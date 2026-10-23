// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingIcon } from "@/entrypoints/content/components/FloatingIcon";

afterEach(() => {
  cleanup();
});

describe("FloatingIcon", () => {
  it("preserves the host-page selection while opening the lens", () => {
    const onClick = vi.fn<() => void>();
    render(
      <FloatingIcon
        floatingStyles={{ transform: "translate(120px, 48px)" }}
        locale="en"
        onClick={onClick}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Convert selected price",
    });

    expect(trigger.style.transform).toBe("translate(120px, 48px)");
    expect(trigger.querySelector("img")?.alt).toBe("");
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(fireEvent.mouseDown(trigger)).toBe(false);
    fireEvent.click(trigger);

    expect(onClick).toHaveBeenCalledOnce();
  });
});
