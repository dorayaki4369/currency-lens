// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App, { createPopupRouter } from "@/entrypoints/popup/App";
import { Route } from "@/entrypoints/popup/routes/__root";
import { POPUP_PREVIEW, resetPopupTestEnvironment } from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup root route", () => {
  it("roots the popup router and hands its preview context to the application", async () => {
    const router = createPopupRouter({ preview: { ...POPUP_PREVIEW, locale: "ja" } });
    await router.load();
    render(<App router={router} />);

    expect(router.routeTree).toBe(Route);
    expect(await screen.findByRole("button", { name: "設定を開く" })).toBeDefined();
  });
});
