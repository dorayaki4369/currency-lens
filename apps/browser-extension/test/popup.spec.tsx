// @vitest-environment happy-dom

import { currencies } from "@cl/currency";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PopupPreviewData } from "../entrypoints/popup/App";
import App from "../entrypoints/popup/App";

const PREVIEW: PopupPreviewData = {
  config: {
    favorites: ["JPY", "EUR", "GBP"],
    showCurrencyCode: true,
    showCurrencyIcon: true,
    symbolOverrides: { $: "USD" },
    theme: "light",
  },
  locale: "en",
  rates: {
    base: "USD",
    fetchedAt: 1_753_000_000_000,
    isStale: false,
    rates: { EUR: "0.86", GBP: "0.74", JPY: "149.45", USD: "1" },
    sourceTimestamp: 1_753_000_000_000,
    warnings: [],
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("popup settings", () => {
  it("renders conversion targets without a manual update button or rate pulse", () => {
    render(<App preview={PREVIEW} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Currency Lens");
    expect(screen.getByRole("heading", { name: "Conversion targets" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Conversion settings" })).toBeDefined();
    expect(screen.queryByText("Favorite currencies")).toBeNull();
    expect(screen.queryByText("Rate pulse")).toBeNull();
    expect(screen.queryByRole("button", { name: /save|update/u })).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: /^Reorder /u })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Reorder JPY, position 1 of 3",
      "Reorder EUR, position 2 of 3",
      "Reorder GBP, position 3 of 3",
    ]);
    expect(screen.queryByRole("button", { name: /^Move .+ (?:up|down)$/u })).toBeNull();
    expect(
      screen
        .getAllByLabelText(/^Remove /u)
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Remove JPY", "Remove EUR", "Remove GBP"]);
    expect(screen.getByRole("button", { name: "Open conversion settings" })).toBeDefined();
  });

  it("reorders conversion targets only when a drag is dropped", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const messageType = readMessageType(message);
      if (messageType === "GET_CONFIG") {
        return Promise.resolve({ data: PREVIEW.config, success: true });
      }
      if (messageType === "GET_RATES") {
        return Promise.resolve({ data: PREVIEW.rates, success: true });
      }
      if (messageType === "SET_CONFIG") {
        return Promise.resolve({ data: readMessagePayload(message), success: true });
      }
      return Promise.reject(new TypeError("Unexpected message type"));
    });
    vi.stubGlobal("browser", {
      i18n: { getUILanguage: () => "en-US" },
      runtime: { openOptionsPage: vi.fn<() => Promise<void>>(), sendMessage },
    });
    render(<App />);

    const dragHandle = await screen.findByRole("button", {
      name: "Reorder JPY, position 1 of 3",
    });
    const dropRow = screen
      .getByRole("button", { name: "Reorder GBP, position 3 of 3" })
      .closest("li");
    expect(dropRow).not.toBeNull();
    if (dropRow === null) {
      return;
    }
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn<(format: string, data: string) => void>(),
    };

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragOver(dropRow, { clientY: 100, dataTransfer });
    expect(readSetConfigCalls(sendMessage)).toHaveLength(0);
    fireEvent.drop(dropRow, { clientY: 100, dataTransfer });

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        payload: { ...PREVIEW.config, favorites: ["EUR", "GBP", "JPY"] },
        type: "SET_CONFIG",
      }),
    );
    expect(readSetConfigCalls(sendMessage)).toHaveLength(1);
    expect(readRenderedFavoriteCodes()).toEqual(["EUR", "GBP", "JPY"]);
  });

  it("keeps drag handles keyboard operable without visible arrow controls", () => {
    render(<App preview={PREVIEW} />);

    const firstHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 3",
    });
    expect(fireEvent.keyDown(firstHandle, { key: "ArrowUp" })).toBe(false);
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);

    const handle = screen.getByRole("button", {
      name: "Reorder EUR, position 2 of 3",
    });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowUp" });

    expect(readRenderedFavoriteCodes()).toEqual(["EUR", "JPY", "GBP"]);
    expect(document.activeElement).toBe(handle);
    expect(screen.getByText("EUR moved to position 1 of 3.")).toBeDefined();

    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);
    expect(document.activeElement).toBe(handle);
    expect(screen.getByText("EUR moved to position 2 of 3.")).toBeDefined();
  });

  it("adds another conversion target from the complete currency catalog", () => {
    render(<App preview={PREVIEW} />);

    const select = screen.getByLabelText("Add a target");
    expect(select.querySelectorAll("option")).toHaveLength(currencies.length + 1);
    fireEvent.change(select, { target: { value: "CAD" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByLabelText("Remove CAD")).toBeDefined();
    expect(screen.getByText("4/5")).toBeDefined();
  });

  it("persists a change immediately while leaving the remaining controls available", async () => {
    const saveResponse = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const messageType = readMessageType(message);
      if (messageType === "GET_CONFIG") {
        return Promise.resolve({ data: PREVIEW.config, success: true });
      }
      if (messageType === "GET_RATES") {
        return Promise.resolve({ data: PREVIEW.rates, success: true });
      }
      if (messageType === "SET_CONFIG") {
        return saveResponse.promise;
      }
      return Promise.reject(new TypeError("Unexpected message type"));
    });
    vi.stubGlobal("browser", {
      i18n: { getUILanguage: () => "en-US" },
      runtime: { openOptionsPage: vi.fn<() => Promise<void>>(), sendMessage },
    });
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText("Remove GBP")).toBeDefined());
    fireEvent.click(screen.getByLabelText("Remove GBP"));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        payload: { ...PREVIEW.config, favorites: ["JPY", "EUR"] },
        type: "SET_CONFIG",
      }),
    );
    expect(screen.getByText("Saving…")).toBeDefined();
    expect(screen.getByLabelText("Remove EUR")).not.toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: /save|update/u })).toBeNull();

    await act(async () => {
      saveResponse.resolve({
        data: { ...PREVIEW.config, favorites: ["JPY", "EUR"] },
        success: true,
      });
      await saveResponse.promise;
    });
    await waitFor(() => expect(screen.getByText("Saved automatically")).toBeDefined());
  });

  it("renders Japanese copy from the same component", () => {
    render(<App preview={{ ...PREVIEW, locale: "ja" }} />);

    expect(screen.getByRole("heading", { name: "換算先通貨" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "換算設定" })).toBeDefined();
    expect(screen.getByRole("button", { name: "換算設定を開く" })).toBeDefined();
    expect(screen.getByText("自動保存済み")).toBeDefined();
  });
});

it("rolls back an optimistic change when the latest save fails", async () => {
  const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
    const messageType = readMessageType(message);
    if (messageType === "GET_CONFIG") {
      return Promise.resolve({ data: PREVIEW.config, success: true });
    }
    if (messageType === "GET_RATES") {
      return Promise.resolve({ data: PREVIEW.rates, success: true });
    }
    if (messageType === "SET_CONFIG") {
      return Promise.resolve({ error: "Storage quota exceeded", success: false });
    }
    return Promise.reject(new TypeError("Unexpected message type"));
  });
  vi.stubGlobal("browser", {
    i18n: { getUILanguage: () => "en-US" },
    runtime: { openOptionsPage: vi.fn<() => Promise<void>>(), sendMessage },
  });
  render(<App />);

  await waitFor(() => expect(screen.getByLabelText("Remove GBP")).toBeDefined());
  fireEvent.click(screen.getByLabelText("Remove GBP"));

  await waitFor(() =>
    expect(screen.getByText("Couldn’t save your settings.")).toBeDefined(),
  );
  expect(screen.getByLabelText("Remove GBP")).toBeDefined();
  expect(screen.getByText("3/5")).toBeDefined();
});

describe("popup boundary and edge states", () => {
  it("shows stale rates and an empty conversion-target state", () => {
    render(
      <App
        preview={{
          ...PREVIEW,
          config: { ...PREVIEW.config, favorites: [] },
          rates: { ...PREVIEW.rates, isStale: true },
        }}
      />,
    );

    expect(screen.getByText("Last known")).toBeDefined();
    expect(screen.getByText("Add a currency to activate conversions.")).toBeDefined();
    expect(document.querySelector(".cl-status--stale")).not.toBeNull();
  });

  it.each(["response", "throw"] as const)(
    "shows offline rates after a failed %s",
    async (failureMode) => {
      const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
        if (readMessageType(message) === "GET_CONFIG") {
          return Promise.resolve({ data: PREVIEW.config, success: true });
        }
        return failureMode === "response"
          ? Promise.resolve({ error: "Rates unavailable", success: false })
          : Promise.reject(new Error("Worker unavailable"));
      });
      stubPopupBrowser(sendMessage);
      render(<App />);

      expect(screen.getByText("Syncing")).toBeDefined();
      expect(await screen.findByText("Offline")).toBeDefined();
    },
  );

  it("shows a configuration error when loading finishes without config", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ error: "Configuration unavailable", success: false })
        : Promise.resolve({ data: PREVIEW.rates, success: true }),
    );
    stubPopupBrowser(sendMessage);
    render(<App />);

    await waitFor(() =>
      expect(screen.getAllByText("Couldn’t save your settings.")).toHaveLength(2),
    );
  });

  it("rejects duplicate, unknown, and over-limit target additions", () => {
    const { unmount } = render(<App preview={PREVIEW} />);
    const select = screen.getByLabelText<HTMLSelectElement>("Add a target");

    select
      .querySelector<HTMLOptionElement>('option[value="JPY"]')
      ?.removeAttribute("disabled");
    fireEvent.change(select, { target: { value: "JPY" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);

    const unknownOption = document.createElement("option");
    unknownOption.value = "ZZZ";
    unknownOption.textContent = "ZZZ";
    select.append(unknownOption);
    fireEvent.change(select, { target: { value: "ZZZ" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);

    unmount();
    render(
      <App
        preview={{
          ...PREVIEW,
          config: {
            ...PREVIEW.config,
            favorites: ["JPY", "EUR", "GBP", "USD", "CAD"],
          },
        }}
      />,
    );
    const fullSelect = screen.getByLabelText<HTMLSelectElement>("Add a target");
    fullSelect.disabled = false;
    fireEvent.change(fullSelect, { target: { value: "CNY" } });
    const add = screen.getByRole<HTMLButtonElement>("button", { name: "Add" });
    add.disabled = false;
    fireEvent.click(add);
    expect(readRenderedFavoriteCodes()).toHaveLength(5);
  });

  it("opens the real options page but leaves preview navigation inert", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    const { unmount } = render(<App preview={PREVIEW} />);
    fireEvent.click(screen.getByRole("button", { name: "Open conversion settings" }));
    expect(close).not.toHaveBeenCalled();
    unmount();

    const openOptionsPage = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ data: PREVIEW.config, success: true })
        : Promise.resolve({ data: PREVIEW.rates, success: true }),
    );
    stubPopupBrowser(sendMessage, openOptionsPage);
    render(<App />);
    const open = await screen.findByRole("button", {
      name: "Open conversion settings",
    });
    fireEvent.click(open);

    await waitFor(() => expect(openOptionsPage).toHaveBeenCalledOnce());
    expect(close).toHaveBeenCalledOnce();
  });

  it("updates valid display controls and ignores an unsupported theme", () => {
    const { container } = render(<App preview={PREVIEW} />);
    const theme = screen.getByLabelText<HTMLSelectElement>("Theme");

    fireEvent.change(theme, { target: { value: "dark" } });
    expect(container.querySelector("main")?.className).toContain("cl-theme-dark");

    const unsupported = document.createElement("option");
    unsupported.value = "sepia";
    unsupported.textContent = "Sepia";
    theme.append(unsupported);
    fireEvent.change(theme, { target: { value: "sepia" } });
    expect(container.querySelector("main")?.className).toContain("cl-theme-dark");

    const iconToggle = screen.getByLabelText<HTMLInputElement>("Show currency symbols");
    const codeToggle = screen.getByLabelText<HTMLInputElement>("Show ISO currency codes");
    fireEvent.click(iconToggle);
    fireEvent.click(codeToggle);
    expect(iconToggle.checked).toBe(false);
    expect(codeToggle.checked).toBe(false);
  });

  it("handles cancelled, same-row, and no-op pointer reorders", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      createBounds({ height: 100, top: 0 }),
    );
    render(<App preview={PREVIEW} />);
    const jpyHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 3",
    });
    const jpyRow = requireRow(jpyHandle);
    const eurRow = requireRow(
      screen.getByRole("button", { name: "Reorder EUR, position 2 of 3" }),
    );
    const dataTransfer = createDataTransfer();

    expect(fireEvent.dragOver(eurRow, { clientY: 10, dataTransfer })).toBe(true);
    fireEvent.drop(eurRow, { clientY: 10, dataTransfer });
    fireEvent.dragStart(jpyHandle, { dataTransfer });
    expect(fireEvent.dragOver(jpyRow, { clientY: 10, dataTransfer })).toBe(true);
    fireEvent.drop(jpyRow, { clientY: 10, dataTransfer });
    const currentJpyHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 3",
    });
    fireEvent.dragStart(currentJpyHandle, { dataTransfer });
    const currentEurRow = requireRow(
      screen.getByRole("button", { name: "Reorder EUR, position 2 of 3" }),
    );
    fireEvent(currentEurRow, createDragEvent("drop", 10));
    fireEvent.dragEnd(jpyHandle, { dataTransfer });

    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);
  });

  it("ignores unrelated reorder keys", () => {
    render(<App preview={PREVIEW} />);
    const handle = screen.getByRole("button", {
      name: "Reorder EUR, position 2 of 3",
    });

    expect(fireEvent.keyDown(handle, { key: "Enter" })).toBe(true);
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);
  });

  it("renders a currency without region metadata", () => {
    render(
      <App
        preview={{
          ...PREVIEW,
          config: {
            ...PREVIEW.config,
            favorites: ["BTC"],
          },
        }}
      />,
    );

    expect(screen.getAllByText("BTC").length).toBeGreaterThan(0);
  });

  it("falls back to codes when a currency symbol is absent or formatting throws", () => {
    const parts = vi
      .spyOn(Intl.NumberFormat.prototype, "formatToParts")
      .mockReturnValue([{ type: "integer", value: "0" }]);
    const { container, unmount } = render(
      <App
        preview={{
          ...PREVIEW,
          config: { ...PREVIEW.config, favorites: ["JPY"] },
        }}
      />,
    );
    expect(container.querySelector(".cl-currency-mark")?.textContent).toBe("J");
    unmount();
    parts.mockRestore();

    vi.spyOn(Intl, "NumberFormat").mockImplementation(() => {
      throw new RangeError("Unsupported currency");
    });
    const thrown = render(
      <App
        preview={{
          ...PREVIEW,
          config: { ...PREVIEW.config, favorites: ["JPY"] },
        }}
      />,
    );
    expect(thrown.container.querySelector(".cl-currency-mark")?.textContent).toBe("J");
  });
});

/** Reads only the discriminant needed by the browser-message test double. */
function readMessageType(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "type")
    : undefined;
}

/** Reads the message payload without widening the production message contract in tests. */
function readMessagePayload(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "payload")
    : undefined;
}

/** Selects only configuration writes from the mixed browser-message mock. */
function readSetConfigCalls(
  sendMessage: ReturnType<typeof vi.fn<(message: unknown) => Promise<unknown>>>,
): unknown[][] {
  return sendMessage.mock.calls.filter(
    ([message]) => readMessageType(message) === "SET_CONFIG",
  );
}

/** Returns the visible target order through the stable remove-button labels. */
function readRenderedFavoriteCodes(): string[] {
  return screen
    .getAllByLabelText(/^Remove /u)
    .map((button) => button.getAttribute("aria-label")?.replace(/^Remove /u, "") ?? "");
}

/** Installs the browser capabilities used by the popup boundary. */
function stubPopupBrowser(
  sendMessage: ReturnType<typeof vi.fn<(message: unknown) => Promise<unknown>>>,
  openOptionsPage = vi.fn<() => Promise<void>>(() => Promise.resolve()),
): void {
  vi.stubGlobal("browser", {
    i18n: { getUILanguage: () => "en-US" },
    runtime: { openOptionsPage, sendMessage },
  });
}

/** Returns the list row that owns a reorder handle. */
function requireRow(handle: HTMLElement): HTMLLIElement {
  const row = handle.closest("li");
  if (!(row instanceof HTMLLIElement)) {
    throw new TypeError("Expected a conversion-target list row");
  }
  return row;
}

/** Produces DOM geometry with explicit overrides for pointer placement tests. */
function createBounds(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

/** Creates the minimal drag data boundary used by React drag handlers. */
function createDataTransfer(): {
  dropEffect: string;
  effectAllowed: string;
  setData: ReturnType<typeof vi.fn<(format: string, data: string) => void>>;
} {
  return {
    dropEffect: "none",
    effectAllowed: "none",
    setData: vi.fn<(format: string, data: string) => void>(),
  };
}

/** Creates a drag event whose pointer position is observable in happy-dom. */
function createDragEvent(type: string, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientY", { value: clientY });
  return event;
}
