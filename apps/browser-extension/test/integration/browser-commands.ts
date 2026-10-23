/// <reference types="@vitest/browser-playwright" />
// The reference adds the Playwright page and frame to the command context type.
import type { BrowserCommand } from "vitest/node";

export interface MediaEmulation {
  readonly colorScheme?: "dark" | "light";
  readonly reducedMotion?: "no-preference" | "reduce";
}

export interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

interface SerializedLocator {
  readonly selector: string;
}

/** Applies media features to the whole test page, including the test iframe. */
const emulateMedia: BrowserCommand<[MediaEmulation]> = async (context, media) => {
  await context.page.emulateMedia(media);
};

/** Moves the real mouse over an element, letting Playwright map iframe coordinates. */
const pointerHover: BrowserCommand<[SerializedLocator, PointerPosition?]> = async (
  context,
  { selector },
  position,
) => {
  const frame = await context.frame();
  await frame.locator(selector).hover({
    force: true,
    ...(position === undefined ? {} : { position }),
  });
};

/** Presses the primary mouse button at the current pointer position. */
const pointerDown: BrowserCommand = async (context) => {
  await context.page.mouse.down();
};

/** Releases the primary mouse button at the current pointer position. */
const pointerUp: BrowserCommand = async (context) => {
  await context.page.mouse.up();
};

export const browserIntegrationCommands = {
  emulateMedia,
  pointerDown,
  pointerHover,
  pointerUp,
};
