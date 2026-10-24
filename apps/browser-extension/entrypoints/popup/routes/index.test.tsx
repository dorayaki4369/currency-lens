// @vitest-environment happy-dom

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as i18n from "@/lib/i18n";
import {
  choosePopupCurrency as chooseCurrency,
  POPUP_PREVIEW as PREVIEW,
  readPopupMessagePayload as readMessagePayload,
  readPopupMessageType as readMessageType,
  readSetConfigCalls,
  renderPopup,
  resetPopupTestEnvironment,
  stubPopupBrowser,
} from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup converter route", () => {
  it("keeps target management behind an explicit edit mode on the top screen", async () => {
    await renderPopup(PREVIEW);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Currency Lens");
    expect(screen.getByRole("main").dataset["theme"]).toBe("light");
    expect(screen.getByRole("heading", { name: "Original" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Conversion targets" })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>("Amount").value).toBe("1");
    expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain("USD");
    expect(screen.getByText("149.00")).toBeDefined();
    expect(screen.getByText("0.86")).toBeDefined();
    expect(screen.getByText("0.74")).toBeDefined();
    expect(screen.getByRole("button", { name: "Open settings" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Appearance" })).toBeNull();
    expect(screen.queryByText("Choose the display theme for Currency Lens.")).toBeNull();
    expect(screen.queryByRole("button", { name: /save|update/u })).toBeNull();
    const targetList = screen.getByRole("list", { name: "Conversion targets" });
    expect(within(targetList).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/^Rates from /u)).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit conversion targets" })).toBeDefined();
    expect(screen.queryByLabelText("Add a target")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reorder /u })).toBeNull();
    expect(screen.queryByLabelText(/^Remove /u)).toBeNull();
    expect(
      screen.queryByText(
        "The selected price is converted into each currency below, in this order.",
      ),
    ).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);

    await enterTargetEditMode();

    expect(
      screen.getByRole("button", { name: "Finish editing conversion targets" }),
    ).toBeDefined();
    expect(screen.getByLabelText("Add a target")).toBeDefined();
    expect(screen.getByText("149.00")).toBeDefined();
    expect(screen.getByText("0.86")).toBeDefined();
    expect(screen.getByText("0.74")).toBeDefined();
    expect(
      screen
        .getAllByRole("button", { name: /^Reorder /u })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Reorder JPY, position 1 of 3",
      "Reorder EUR, position 2 of 3",
      "Reorder GBP, position 3 of 3",
    ]);
    const firstHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 3",
    });
    expect(firstHandle.querySelector('[data-currency-icon="JPY"]')).toBeNull();
    expect(
      firstHandle.closest("li")?.querySelector('[data-currency-icon="JPY"]'),
    ).not.toBeNull();
    fireEvent.mouseEnter(firstHandle);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Move .+ (?:up|down)$/u })).toBeNull();
    expect(
      screen
        .getAllByLabelText(/^Remove /u)
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Remove JPY", "Remove EUR", "Remove GBP"]);
  });

  it("recalculates targets when the source amount or currency changes", async () => {
    await renderPopup(PREVIEW);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2" } });
    expect(screen.getByText("299.00")).toBeDefined();

    await chooseCurrency("Currency", "EUR", "Euro");
    expect(screen.getByText("348.00")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    expect(screen.getByText("Enter an amount greater than 0.")).toBeDefined();
    expect(screen.getAllByText("-")).toHaveLength(3);
  });

  it("rerenders only target amounts when the source input changes", async () => {
    const getCurrencyDisplayName = vi.spyOn(i18n, "getCurrencyDisplayName");
    const targetCodes: ReadonlySet<string> = new Set(PREVIEW.config.favorites);
    const countTargetIdentityRenders = () =>
      getCurrencyDisplayName.mock.calls.filter(([currencyCode]) =>
        targetCodes.has(currencyCode),
      ).length;
    await renderPopup(PREVIEW);

    getCurrencyDisplayName.mockClear();
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2" } });

    expect(screen.getByText("299.00")).toBeDefined();
    expect(countTargetIdentityRenders()).toBe(0);

    const trigger = screen.getByRole("combobox", { name: "Currency" });
    fireEvent.click(trigger);
    const search = await screen.findByPlaceholderText("Code, name, or region");
    fireEvent.change(search, { target: { value: "CAD" } });
    const option = await screen.findByRole("option", { name: /^CAD\b/u });
    getCurrencyDisplayName.mockClear();
    fireEvent.click(option);

    expect(trigger.textContent).toContain("CAD");
    expect(screen.getAllByText("Rate unavailable")).toHaveLength(3);
    expect(countTargetIdentityRenders()).toBe(0);
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
    stubPopupBrowser(sendMessage);
    await renderPopup();
    await enterTargetEditMode();

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

  it("keeps drag handles keyboard operable without visible arrow controls", async () => {
    await renderPopup(PREVIEW);
    await enterTargetEditMode();

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

  it("adds another conversion target from the complete currency catalog", async () => {
    await renderPopup(PREVIEW);
    await enterTargetEditMode();

    await chooseCurrency("Add a target", "CAD", "Canadian", "Add a target");

    expect(screen.getByLabelText("Remove CAD")).toBeDefined();
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP", "CAD"]);
  });

  it("persists a deletion after its exit while leaving remaining controls available", async () => {
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
    stubPopupBrowser(sendMessage);
    await renderPopup();
    await enterTargetEditMode();

    fireEvent.click(screen.getByLabelText("Remove GBP"));
    expect(readSetConfigCalls(sendMessage)).toHaveLength(0);
    finishFavoriteDeletion("GBP");

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        payload: { ...PREVIEW.config, favorites: ["JPY", "EUR"] },
        type: "SET_CONFIG",
      }),
    );
    expect(screen.queryByText("Saving…")).toBeNull();
    expect(screen.getByLabelText("Remove EUR")).not.toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: /save|update/u })).toBeNull();

    await act(async () => {
      saveResponse.resolve({
        data: { ...PREVIEW.config, favorites: ["JPY", "EUR"] },
        success: true,
      });
      await saveResponse.promise;
    });
    await waitFor(() => expect(screen.queryByText("Saved automatically")).toBeNull());
  });

  it("renders Japanese converter copy", async () => {
    await renderPopup({ ...PREVIEW, locale: "ja" });

    expect(screen.getByRole("heading", { name: "換算元" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "換算後" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "換算設定" })).toBeNull();
    expect(screen.queryByText("その場で為替換算")).toBeNull();
    expect(screen.queryByText("レート取得済み")).toBeNull();
    expect(screen.getByRole("button", { name: "設定を開く" })).toBeDefined();
    expect(screen.queryByText("Currency Lens の表示テーマを選びます。")).toBeNull();
    expect(screen.queryByText("自動保存済み")).toBeNull();
    expect(
      screen.queryByText("ページ上の金額を選択し、横に表示されるレンズを開きます。"),
    ).toBeNull();
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
    stubPopupBrowser(sendMessage);
    await renderPopup();
    await enterTargetEditMode();

    fireEvent.click(screen.getByLabelText("Remove GBP"));
    expect(readSetConfigCalls(sendMessage)).toHaveLength(0);
    finishFavoriteDeletion("GBP");

    await waitFor(() =>
      expect(screen.getByText("Couldn’t save your settings.")).toBeDefined(),
    );
    expect(screen.getByLabelText("Remove GBP")).toBeDefined();
    expect(screen.getByLabelText("Remove GBP").closest("[data-delete-state]")).toBeNull();
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);
  });
});

describe("popup boundary and edge states", () => {
  it("shows target placeholders while rates are still loading", async () => {
    const ratesResponse = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ data: PREVIEW.config, success: true })
        : ratesResponse.promise,
    );
    stubPopupBrowser(sendMessage);
    await renderPopup();

    expect(
      await screen.findByRole("status", { name: "Converting currency" }),
    ).toBeDefined();
    expect(
      document.querySelectorAll('[data-slot="skeleton"][aria-hidden="true"]'),
    ).toHaveLength(3);

    await act(async () => {
      ratesResponse.resolve({ data: PREVIEW.rates, success: true });
      await ratesResponse.promise;
    });
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Converting currency" })).toBeNull(),
    );
    expect(screen.getByText("149.00")).toBeDefined();
  });

  it("shows stale rates and an empty conversion-target state", async () => {
    await renderPopup({
      ...PREVIEW,
      config: { ...PREVIEW.config, favorites: [] },
      rates: { ...PREVIEW.rates, isStale: true },
    });

    expect(screen.getByText("Add a currency to activate conversions.")).toBeDefined();
    const warning = screen.getByRole("status");
    expect(warning.textContent).toContain("Rates from");
    expect(warning.textContent).toContain("at least 24 hours old");
  });

  it.each(["response", "throw"] as const)(
    "shows unavailable targets after a failed rates %s",
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
      await renderPopup();

      expect(await screen.findAllByText("Rate unavailable")).toHaveLength(3);
      expect(screen.queryByText(/^Rates from /u)).toBeNull();
    },
  );

  it("prevents duplicate, unknown, and over-limit target additions", async () => {
    const { unmount } = await renderPopup(PREVIEW);
    await enterTargetEditMode();
    const select = screen.getByRole("combobox", { name: "Add a target" });
    fireEvent.click(select);
    const search = await screen.findByPlaceholderText("Code, name, or region");
    fireEvent.change(search, { target: { value: "ZZZ" } });
    expect(await screen.findByText("No matching currency found.")).toBeDefined();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);

    fireEvent.change(search, { target: { value: "JPY" } });
    const duplicate = await screen.findByRole("option", { name: /^JPY\b/u });
    expect(duplicate.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(duplicate);
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);

    unmount();
    await renderPopup({
      ...PREVIEW,
      config: {
        ...PREVIEW.config,
        favorites: ["JPY", "EUR", "GBP", "USD", "CAD"],
      },
    });
    await enterTargetEditMode();
    expect(screen.queryByRole("combobox", { name: "Add a target" })).toBeNull();
    expect(readRenderedFavoriteCodes()).toHaveLength(5);
  });

  it("handles cancelled, same-row, and no-op pointer reorders", async () => {
    const rowTops: Readonly<Record<string, number | undefined>> = {
      JPY: 0,
      EUR: 100,
      GBP: 200,
    };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const currencyCode = this.dataset["listCurrencyCode"];
        return createBounds({ height: 100, top: rowTops[currencyCode ?? ""] ?? 0 });
      },
    );
    await renderPopup(PREVIEW);
    await enterTargetEditMode();
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
    expect(fireEvent(jpyRow, createDragEvent("dragover", 10, dataTransfer))).toBe(true);
    fireEvent(jpyRow, createDragEvent("drop", 10, dataTransfer));
    const currentJpyHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 3",
    });
    fireEvent.dragStart(currentJpyHandle, { dataTransfer });
    const currentEurRow = requireRow(
      screen.getByRole("button", { name: "Reorder EUR, position 2 of 3" }),
    );
    fireEvent(currentEurRow, createDragEvent("dragover", 10, dataTransfer));
    expect(currentEurRow.getAttribute("data-drop-placement")).toBeNull();
    fireEvent(currentEurRow, createDragEvent("dragover", 190, dataTransfer));
    expect(currentEurRow.getAttribute("data-drop-placement")).toBe("after");
    fireEvent(currentEurRow, createDragEvent("dragover", 110, dataTransfer));
    expect(currentEurRow.getAttribute("data-drop-placement")).toBeNull();
    fireEvent(currentEurRow, createDragEvent("drop", 110));
    fireEvent.dragEnd(jpyHandle, { dataTransfer });

    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);
  });

  it("ignores unrelated reorder keys", async () => {
    await renderPopup(PREVIEW);
    await enterTargetEditMode();
    const handle = screen.getByRole("button", {
      name: "Reorder EUR, position 2 of 3",
    });

    expect(fireEvent.keyDown(handle, { key: "Enter" })).toBe(true);
    expect(readRenderedFavoriteCodes()).toEqual(["JPY", "EUR", "GBP"]);
  });

  it("renders a currency without region metadata", async () => {
    await renderPopup({
      ...PREVIEW,
      config: {
        ...PREVIEW.config,
        favorites: ["BTC"],
      },
    });

    expect(screen.getAllByText("BTC").length).toBeGreaterThan(0);
  });
});

/** Opens target editing for tests that exercise saved target changes. */
async function enterTargetEditMode(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Edit conversion targets" }));
}

/** Returns the visible target order through the stable remove-button labels. */
function readRenderedFavoriteCodes(): string[] {
  return screen
    .getAllByLabelText(/^Remove /u)
    .map((button) => button.getAttribute("aria-label")?.replace(/^Remove /u, "") ?? "");
}

/** Finishes the visual exit so persistence assertions observe the settled list. */
function finishFavoriteDeletion(currencyCode: string): void {
  const row = screen.getByLabelText(`Remove ${currencyCode}`).closest("li");
  const animatedContent = row?.querySelector('[data-slot="list-item-row"]');
  if (!(animatedContent instanceof HTMLElement)) {
    throw new TypeError(`Expected the animated ${currencyCode} row`);
  }
  const event = new Event("transitionend", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "propertyName", { value: "translate" });
  fireEvent(animatedContent, event);
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
function createDragEvent(
  type: string,
  clientY: number,
  dataTransfer?: ReturnType<typeof createDataTransfer>,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientY", { value: clientY });
  if (dataTransfer !== undefined) {
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  }
  return event;
}
