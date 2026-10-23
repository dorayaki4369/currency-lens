// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "@/components/ui/skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("forwards decorative state and presentation classes", () => {
    render(<Skeleton aria-hidden="true" className="h-4" />);

    const skeleton = document.querySelector('[data-slot="skeleton"]');
    expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton?.classList.contains("h-4")).toBe(true);
  });
});
