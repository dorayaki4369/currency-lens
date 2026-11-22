import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "@/test/integration/style.css";
import { messageTypes, type Message } from "@/lib/messages";
import App from "@/entrypoints/content/App";
import {
  FIXTURE_CONFIG,
  FIXTURE_CONVERSION_DATA,
  FIXTURE_HISTORY,
} from "@/test/integration/fixture-data";
import { saveReviewScreenshot, setViewport } from "@/test/integration/browser-harness";

// Must match FLOATING_PADDING in the content App.
const VIEWPORT_MARGIN = 12;
const SHORT_VIEWPORT = { height: 600, width: 1_000 } as const;

beforeEach(async () => {
  await setViewport(SHORT_VIEWPORT);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it("keeps the conversion card inside a short viewport and scrolls only its body", async () => {
  installContentBrowser();
  // A selection in the middle leaves less room above and below than the rates need.
  let currentSelection: Selection | null = null;
  vi.spyOn(window, "getSelection").mockImplementation(() => currentSelection);
  render(<App />);
  await act(async () => {});
  currentSelection = selectionWith("$249.00", new DOMRect(320, 290, 64, 20));
  vi.useFakeTimers();
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(180);
  });
  vi.useRealTimers();
  fireEvent.click(await screen.findByRole("button", { name: /Show all conversions$/u }));
  await screen.findByRole("dialog", { name: "Conversion result" });

  await userEvent.click(page.getByRole("radio", { name: "Rates", exact: true }));
  await expect.element(page.getByRole("slider")).toBeInTheDocument();
  const card = requireCardParts();
  await expect.poll(() => readCardBounds(card.dialog)).toSatisfy(fitsViewport);

  // The close button and the switch stay put while the body scrolls under them.
  const switchTop = card.screenSwitch.getBoundingClientRect().top;
  expect(card.body.scrollHeight).toBeGreaterThan(card.body.clientHeight);
  card.body.scrollTop = card.body.scrollHeight;
  expect(card.screenSwitch.getBoundingClientRect().top).toBe(switchTop);
  const bodyBottom = card.body.getBoundingClientRect().bottom;
  const timestamp = page.getByRole("link", { name: "Open Exchange Rates" }).element();
  expect(timestamp.getBoundingClientRect().bottom).toBeLessThanOrEqual(bodyBottom);
  await saveReviewScreenshot("conversion-short-viewport-rates");
});

interface CardParts {
  readonly body: HTMLElement;
  readonly dialog: HTMLElement;
  readonly screenSwitch: HTMLElement;
}

/** Finds the card's dialog, its scrolling body, and its screen switch. */
function requireCardParts(): CardParts {
  const dialog = screen.getByRole("dialog", { name: "Conversion result" });
  const body = dialog.querySelector<HTMLElement>('[data-slot="conversion-card-body"]');
  if (body === null) {
    throw new Error("The conversion card has no body");
  }
  return { body, dialog, screenSwitch: screen.getByRole("radiogroup", { name: "Screen" }) };
}

/** Reads where the card sits, so a poll can wait for Floating UI to place it. */
function readCardBounds(dialog: HTMLElement): DOMRect {
  return dialog.getBoundingClientRect();
}

/** Tells whether the card keeps the shared margin inside the viewport on both ends. */
function fitsViewport(bounds: DOMRect): boolean {
  return (
    bounds.top >= VIEWPORT_MARGIN - 0.5 &&
    bounds.bottom <= SHORT_VIEWPORT.height - VIEWPORT_MARGIN + 0.5
  );
}

/** Answers the content script's messages with fixed configuration, rates, and history. */
function installContentBrowser(): void {
  const sendMessage = vi.fn<(message: Message) => Promise<unknown>>((message) => {
    if (message.type === messageTypes.GET_CONFIG) {
      return Promise.resolve({ data: FIXTURE_CONFIG, success: true });
    }
    if (message.type === messageTypes.CONVERT_CURRENCIES) {
      return Promise.resolve({
        data: { ...FIXTURE_CONVERSION_DATA, warnings: [] },
        success: true,
      });
    }
    if (message.type === messageTypes.GET_RATE_HISTORY) {
      return Promise.resolve({
        data: FIXTURE_HISTORY[message.payload.resolution],
        success: true,
      });
    }
    return Promise.resolve({ error: "Unexpected message", success: false });
  });
  vi.stubGlobal("browser", {
    i18n: { getUILanguage: () => "en-US" },
    runtime: { sendMessage },
    storage: {
      onChanged: { addListener: () => undefined, removeListener: () => undefined },
    },
  });
}

/** Builds the DOM selection that the content script reads. */
function selectionWith(text: string, rect: DOMRect): Selection {
  return {
    getRangeAt: () =>
      ({
        commonAncestorContainer: document.body,
        getBoundingClientRect: () => rect,
      }) as unknown as Range,
    isCollapsed: false,
    rangeCount: 1,
    toString: () => text,
  } as unknown as Selection;
}
