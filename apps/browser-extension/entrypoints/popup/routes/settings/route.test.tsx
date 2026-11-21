// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App, { createPopupRouter } from "@/entrypoints/popup/App";
import { Route } from "@/entrypoints/popup/routes/settings/route";
import { POPUP_PREVIEW, resetPopupTestEnvironment } from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup settings layout route", () => {
  it("groups the settings pages and renders the matched child page", async () => {
    const router = createPopupRouter({ preview: POPUP_PREVIEW });
    await router.load();
    render(<App router={router} />);
    await router.navigate({ to: "/settings" });

    expect(router.routesById["/settings"]).toBe(Route);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
  });
});
