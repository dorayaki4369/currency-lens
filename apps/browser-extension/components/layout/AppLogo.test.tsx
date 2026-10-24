// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import appLogoUrl from "@/assets/icon.svg?inline";
import { AppLogo } from "@/components/layout/AppLogo";

afterEach(cleanup);

describe("AppLogo", () => {
  it("uses the app artwork decoratively beside existing labels", () => {
    render(<AppLogo />);

    const logo = screen.getByRole<HTMLImageElement>("presentation");
    expect(logo.getAttribute("src")).toBe(appLogoUrl);
    expect(logo.getAttribute("draggable")).toBe("false");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("names the product when the logo stands alone", () => {
    render(<AppLogo alt="Currency Lens" className="size-9" />);

    expect(screen.getByRole("img", { name: "Currency Lens" })).toBeDefined();
  });
});
