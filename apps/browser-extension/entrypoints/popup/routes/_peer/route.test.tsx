// @vitest-environment happy-dom

import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App, { createPopupRouter } from "@/entrypoints/popup/App";
import { Route } from "@/entrypoints/popup/routes/_peer/route";
import {
  getSegmentedThumb,
  POPUP_HISTORY,
  POPUP_PREVIEW,
  resetPopupTestEnvironment,
} from "@/test/popup";

afterEach(resetPopupTestEnvironment);

/** Reads which peer screen the shared screen switch marks as checked. */
function readCheckedScreen(): string | null {
  return (
    within(screen.getByRole("radiogroup", { name: "Screen" }))
      .getAllByRole("radio")
      .find((radio) => radio.getAttribute("aria-checked") === "true")?.textContent ?? null
  );
}

describe("popup peer layout route", () => {
  it("frames the converter and rates as one layout that stays mounted between them", async () => {
    const router = createPopupRouter({
      preview: { ...POPUP_PREVIEW, history: POPUP_HISTORY },
    });
    await router.load();
    render(<App router={router} />);

    expect(router.routesById["/_peer"]).toBe(Route);
    expect(
      await screen.findByRole("heading", { name: "Conversion targets" }),
    ).toBeDefined();
    expect(readCheckedScreen()).toBe("Convert");
    const frame = document.querySelector('[data-slot="popup-route"]');
    const thumb = getSegmentedThumb("Screen");
    expect(frame).not.toBeNull();
    expect(thumb).not.toBeNull();

    await act(() => router.navigate({ to: "/rates" }));
    expect(await screen.findByRole("heading", { name: "Base" })).toBeDefined();
    expect(readCheckedScreen()).toBe("Rates");
    expect(document.querySelector('[data-slot="popup-route"]')).toBe(frame);
    expect(getSegmentedThumb("Screen")).toBe(thumb);

    await act(() => router.navigate({ to: "/" }));
    expect(
      await screen.findByRole("heading", { name: "Conversion targets" }),
    ).toBeDefined();
    expect(readCheckedScreen()).toBe("Convert");
    expect(document.querySelector('[data-slot="popup-route"]')).toBe(frame);
  });
});
