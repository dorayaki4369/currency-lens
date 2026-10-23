// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyValueRow } from "@/components/conversion/CurrencyValueRow";
import { ReorderableCurrencyList } from "@/components/conversion/ReorderableCurrencyList";
import type { CurrencyDropPlacement } from "@/lib/currency-order";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReorderableCurrencyList", () => {
  it("reorders by keyboard and announces the resulting position", () => {
    const onReorder = createReorderCallback();
    renderCurrencyList(onReorder);

    const usdHandle = screen.getByRole("button", {
      name: "Reorder USD, position 1 of 3",
    });
    fireEvent.keyDown(usdHandle, { key: "ArrowDown" });

    expect(onReorder).toHaveBeenCalledWith("USD", "JPY", "after");
    expect(screen.getByText("USD moved to position 2 of 3.")).toBeDefined();

    onReorder.mockClear();
    fireEvent.keyDown(usdHandle, { key: "ArrowUp" });
    fireEvent.keyDown(usdHandle, { key: "Enter" });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("drags the whole row from its handle and exposes one shared boundary", () => {
    const onReorder = createReorderCallback();
    const dataTransfer = createDataTransfer();
    stubCurrencyRowBounds();
    renderCurrencyList(onReorder);

    const eurHandle = screen.getByRole("button", {
      name: "Reorder EUR, position 3 of 3",
    });
    const eurRow = eurHandle.closest("li");
    const usdRow = screen
      .getByRole("button", { name: "Reorder USD, position 1 of 3" })
      .closest("li");
    const jpyRow = screen
      .getByRole("button", { name: "Reorder JPY, position 2 of 3" })
      .closest("li");
    const list = screen.getByRole("list", { name: "Currencies" });
    if (eurRow === null || usdRow === null || jpyRow === null) {
      throw new TypeError("Expected each currency row");
    }
    expect(eurRow.getAttribute("draggable")).toBe("true");
    expect(eurHandle.getAttribute("draggable")).toBe("false");

    fireEvent(usdRow, createDragEvent("dragover", dataTransfer, 1));
    expect(usdRow.querySelector('[data-slot="currency-drop-indicator"]')).toBeNull();

    fireEvent.mouseDown(eurHandle);
    fireEvent.dragStart(eurRow, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "EUR");
    expect(eurRow.getAttribute("data-dragging")).toBe("true");

    fireEvent(usdRow, createDragEvent("dragover", dataTransfer, 19));
    expect(usdRow.getAttribute("data-drop-placement")).toBe("after");
    expect(list.querySelectorAll('[data-slot="currency-drop-indicator"]')).toHaveLength(1);

    fireEvent(jpyRow, createDragEvent("dragover", dataTransfer, 21));
    expect(usdRow.getAttribute("data-drop-placement")).toBe("after");
    expect(list.querySelectorAll('[data-slot="currency-drop-indicator"]')).toHaveLength(1);

    fireEvent(jpyRow, createDragEvent("drop", dataTransfer, 21));
    expect(onReorder).toHaveBeenCalledWith("EUR", "JPY", "before");
    expect(screen.getByText("EUR moved to position 2 of 3.")).toBeDefined();
    expect(document.querySelector('[data-slot="currency-drop-indicator"]')).toBeNull();
  });

  it("does not start a row drag outside the list-owned handle", () => {
    const dataTransfer = createDataTransfer();
    renderCurrencyList(createReorderCallback());
    const handle = screen.getByRole("button", {
      name: "Reorder USD, position 1 of 3",
    });
    const row = screen.getByText("USD item 1").closest("li");
    if (row === null) {
      throw new TypeError("Expected the USD row");
    }

    fireEvent.mouseDown(handle);
    fireEvent.mouseUp(document.body);
    fireEvent.mouseDown(row);
    expect(fireEvent.dragStart(row, { dataTransfer })).toBe(false);
    expect(dataTransfer.setData).not.toHaveBeenCalled();
    expect(row.getAttribute("data-dragging")).toBeNull();

    const list = screen.getByRole("list", { name: "Currencies" });
    expect(fireEvent(list, createDragEvent("dragstart", dataTransfer, 0))).toBe(false);
    const textNode = screen.getByText("USD item 1").firstChild;
    if (textNode === null) {
      throw new TypeError("Expected the USD label text node");
    }
    expect(textNode.dispatchEvent(createDragEvent("dragstart", dataTransfer, 0))).toBe(
      false,
    );
    const nativeElement = Element;
    vi.stubGlobal(
      "Element",
      class NonDomElement {
        readonly isDomElement = false;
      },
    );
    expect(fireEvent(list, createDragEvent("dragstart", dataTransfer, 0))).toBe(false);
    vi.stubGlobal("Element", nativeElement);
    expect(dataTransfer.setData).not.toHaveBeenCalled();
  });

  it("clears a drag boundary only after the pointer leaves the whole list", () => {
    const dataTransfer = createDataTransfer();
    stubCurrencyRowBounds();
    renderCurrencyList(createReorderCallback());
    const handle = screen.getByRole("button", {
      name: "Reorder EUR, position 3 of 3",
    });
    const sourceRow = handle.closest("li");
    const targetRow = screen
      .getByRole("button", { name: "Reorder USD, position 1 of 3" })
      .closest("li");
    const list = screen.getByRole("list", { name: "Currencies" });
    if (sourceRow === null || targetRow === null) {
      throw new TypeError("Expected source and target rows");
    }

    fireEvent.mouseDown(handle);
    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent(targetRow, createDragEvent("dragover", dataTransfer, 19));
    expect(targetRow.getAttribute("data-drop-placement")).toBe("after");

    fireEvent(list, createDragLeaveEvent(targetRow));
    expect(targetRow.getAttribute("data-drop-placement")).toBe("after");
    fireEvent(list, createDragLeaveEvent(document.body));
    expect(targetRow.getAttribute("data-drop-placement")).toBeNull();
    fireEvent.mouseUp(list);
  });

  it("commits deletion after retaining the exiting row and restores focus", async () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(<StatefulCurrencyList onDelete={onDelete} />);
    const removeButton = screen.getByRole("button", { name: "Remove USD" });
    const row = removeButton.closest("li");
    if (row === null) {
      throw new TypeError("Expected the deletable USD row");
    }
    const rowContent = row.querySelector('[data-slot="list-item-row"]');
    if (!(rowContent instanceof HTMLElement)) {
      throw new TypeError("Expected the animated USD row content");
    }

    removeButton.focus();
    fireEvent.click(removeButton);
    removeButton.focus();

    expect(row.getAttribute("data-delete-state")).toBe("exiting");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("USD item 1")).toBeDefined();
    const nextRemoveButton = screen.getByRole("button", { name: "Remove JPY" });

    fireTransitionEnd(rowContent, "transform");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("USD item 1")).toBeDefined();
    fireTransitionEnd(rowContent, "translate");

    expect(onDelete).toHaveBeenCalledWith("USD");
    expect(screen.queryByText("USD item 1")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(nextRemoveButton));
  });

  it("commits a deletion from its timeout fallback", async () => {
    vi.useFakeTimers();
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(<StatefulCurrencyList onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove USD" }));
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(onDelete).toHaveBeenCalledWith("USD");
    expect(screen.queryByText("USD item 1")).toBeNull();
    vi.useRealTimers();
  });

  it("handles a stale deletion fallback after its list unmounts", () => {
    let deletionFallback: (() => void) | undefined;
    const timerHandle = globalThis.setTimeout(() => undefined, 0);
    globalThis.clearTimeout(timerHandle);
    vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, timeout) => {
      if (timeout === 600 && typeof handler === "function") {
        deletionFallback = () => handler();
      }
      return timerHandle;
    });
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    const view = render(<StatefulCurrencyList onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove USD" }));
    view.unmount();
    const capturedFallback = deletionFallback;
    if (capturedFallback === undefined) {
      throw new TypeError("Expected the row deletion fallback");
    }
    act(capturedFallback);

    expect(onDelete).toHaveBeenCalledWith("USD");
  });

  it("ignores duplicate delete starts and completions", () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(<StatefulCurrencyList onDelete={onDelete} />);
    const removeButton = screen.getByRole("button", { name: "Remove USD" });
    const row = removeButton.closest("li");
    const rowContent = row?.querySelector('[data-slot="list-item-row"]');
    if (!(rowContent instanceof HTMLElement)) {
      throw new TypeError("Expected the animated USD row content");
    }

    act(() => {
      removeButton.click();
      removeButton.click();
    });
    act(() => {
      fireTransitionEnd(rowContent, "translate");
      fireTransitionEnd(rowContent, "translate");
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("ignores deletion if a row identity is absent from the active currencies", () => {
    let identityLookupCount = 0;
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(
      <ReorderableCurrencyList
        ariaLabel="Currencies"
        getCurrencyCode={() => {
          identityLookupCount += 1;
          return identityLookupCount === 1 ? "USD" : "JPY";
        }}
        isDeletable
        isDraggable={false}
        items={[{ value: 1 }]}
        locale="en"
        onDelete={onDelete}
        renderItem={(_item, _index, actions) => <div>{actions.trailingAction}</div>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove JPY" }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("ignores keyboard reordering while a row is exiting", () => {
    const onReorder = createReorderCallback();
    renderCurrencyList(onReorder);
    fireEvent.click(screen.getByRole("button", { name: "Remove USD" }));

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Reorder JPY, position 2 of 3" }),
      { key: "ArrowDown" },
    );

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("retains an exiting row beside the closest remaining neighbor", () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    const view = render(
      <CurrencyListFixture
        items={DEFAULT_ITEMS}
        onDelete={onDelete}
        onReorder={createReorderCallback()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove USD" }));

    view.rerender(
      <CurrencyListFixture
        items={["JPY", "EUR"]}
        onDelete={onDelete}
        onReorder={createReorderCallback()}
      />,
    );
    expect(getRenderedCurrencies()).toEqual(["USD", "JPY", "EUR"]);

    finishCurrencyDeletion("USD");
    fireEvent.click(screen.getByRole("button", { name: "Remove EUR" }));
    view.rerender(
      <CurrencyListFixture
        items={["JPY"]}
        onDelete={onDelete}
        onReorder={createReorderCallback()}
      />,
    );
    expect(getRenderedCurrencies()).toEqual(["JPY", "EUR"]);
  });

  it("abandons stale drop boundaries when the parent list changes mid-drag", () => {
    stubCurrencyRowBounds();
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    const onReorder = createReorderCallback();
    const view = render(
      <CurrencyListFixture
        items={DEFAULT_ITEMS}
        onDelete={onDelete}
        onReorder={onReorder}
      />,
    );
    const dataTransfer = createDataTransfer();
    const handle = screen.getByRole("button", {
      name: "Reorder EUR, position 3 of 3",
    });
    const sourceRow = handle.closest("li");
    const targetRow = screen
      .getByRole("button", { name: "Reorder USD, position 1 of 3" })
      .closest("li");
    const list = screen.getByRole("list", { name: "Currencies" });
    if (sourceRow === null || targetRow === null) {
      throw new TypeError("Expected source and target rows");
    }

    fireEvent.mouseDown(handle);
    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent(targetRow, createDragEvent("dragover", dataTransfer, 19));
    view.rerender(
      <CurrencyListFixture
        items={["USD", "EUR", "JPY"]}
        onDelete={onDelete}
        onReorder={onReorder}
      />,
    );
    fireEvent(list, createDragEvent("drop", dataTransfer, 19));
    expect(onReorder).not.toHaveBeenCalled();

    const nextDataTransfer = createDataTransfer();
    const nextHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 3 of 3",
    });
    const nextSourceRow = nextHandle.closest("li");
    const nextTargetRow = screen
      .getByRole("button", { name: "Reorder USD, position 1 of 3" })
      .closest("li");
    if (nextSourceRow === null || nextTargetRow === null) {
      throw new TypeError("Expected the updated source and target rows");
    }
    fireEvent.mouseDown(nextHandle);
    fireEvent.dragStart(nextSourceRow, { dataTransfer: nextDataTransfer });
    fireEvent(nextTargetRow, createDragEvent("dragover", nextDataTransfer, 19));
    view.rerender(
      <CurrencyListFixture items={[]} onDelete={onDelete} onReorder={onReorder} />,
    );
    fireEvent(list, createDragEvent("drop", nextDataTransfer, 19));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("restores focus to a fallback action or the empty list", async () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    const view = render(
      <CurrencyListFixture
        items={DEFAULT_ITEMS}
        onDelete={onDelete}
        onReorder={createReorderCallback()}
      />,
    );
    const removeUsd = screen.getByRole("button", { name: "Remove USD" });
    removeUsd.focus();
    fireEvent.click(removeUsd, { detail: 1 });
    removeUsd.focus();
    view.rerender(
      <CurrencyListFixture
        items={["EUR"]}
        onDelete={onDelete}
        onReorder={createReorderCallback()}
      />,
    );
    finishCurrencyDeletion("USD");
    const fallbackButton = screen.getByRole("button", { name: "Remove EUR" });
    await waitFor(() => expect(document.activeElement).toBe(fallbackButton));

    fallbackButton.focus();
    fireEvent.click(fallbackButton, { detail: 1 });
    fallbackButton.focus();
    view.rerender(
      <CurrencyListFixture
        items={[]}
        onDelete={onDelete}
        onReorder={createReorderCallback()}
      />,
    );
    finishCurrencyDeletion("EUR");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("list", { name: "Currencies" })),
    );
  });

  it("retains rapidly deleted adjacent rows in their original order", () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(<StatefulCurrencyList disableSoleDeletion onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove USD" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove JPY" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(getRenderedCurrencies()).toEqual(["USD", "JPY", "EUR"]);
    expect(
      screen.getByRole("button", { name: "Remove EUR" }).hasAttribute("disabled"),
    ).toBe(true);

    finishCurrencyDeletion("USD");
    expect(onDelete.mock.calls).toEqual([["USD"]]);
    expect(getRenderedCurrencies()).toEqual(["JPY", "EUR"]);
    finishCurrencyDeletion("JPY");
    expect(onDelete.mock.calls).toEqual([["USD"], ["JPY"]]);
    expect(getRenderedCurrencies()).toEqual(["EUR"]);
  });

  it("focuses the remaining row when its final delete button becomes disabled", async () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(
      <StatefulCurrencyList
        disableSoleDeletion
        initialItems={["USD", "JPY"]}
        onDelete={onDelete}
      />,
    );
    const removeButton = screen.getByRole("button", { name: "Remove USD" });
    removeButton.focus();
    fireEvent.click(removeButton);
    removeButton.focus();

    finishCurrencyDeletion("USD");

    const remainingButton = screen.getByRole("button", { name: "Remove JPY" });
    const remainingRow = remainingButton.closest("li");
    expect(remainingButton.hasAttribute("disabled")).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(remainingRow));
  });

  it("does not reclaim focus after the user moves to another control", async () => {
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(
      <>
        <button type="button">Finish editing</button>
        <StatefulCurrencyList onDelete={onDelete} />
      </>,
    );
    const removeButton = screen.getByRole("button", { name: "Remove USD" });
    const finishButton = screen.getByRole("button", { name: "Finish editing" });
    removeButton.focus();
    fireEvent.click(removeButton);
    finishButton.focus();

    finishCurrencyDeletion("USD");

    await waitFor(() => expect(document.activeElement).toBe(finishButton));
  });

  it("restores deletion focus within the list's ShadowRoot", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadowRoot.append(container);
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    const view = render(<StatefulCurrencyList onDelete={onDelete} />, { container });
    const removeButton = view.getByRole("button", { name: "Remove USD" });
    removeButton.focus();
    fireEvent.click(removeButton);
    const nextButton = view.getByRole("button", { name: "Remove JPY" });
    const nextFocus = vi.spyOn(nextButton, "focus");

    finishCurrencyDeletion("USD", container);

    await waitFor(() => expect(nextFocus).toHaveBeenCalledTimes(1));
  });

  it("commits deletion inside a disconnected document fragment", () => {
    const container = document.createDocumentFragment();
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    const view = render(<StatefulCurrencyList onDelete={onDelete} />, {
      container: container as unknown as HTMLElement,
    });

    fireEvent.click(view.getByRole("button", { name: "Remove USD" }));
    finishCurrencyDeletion("USD", container);

    expect(onDelete).toHaveBeenCalledWith("USD");
  });

  it("does not reclaim focus moved outside the list's ShadowRoot", async () => {
    const outsideButton = document.createElement("button");
    outsideButton.textContent = "Outside";
    document.body.append(outsideButton);
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadowRoot.append(container);
    const view = render(<StatefulCurrencyList onDelete={() => undefined} />, {
      container,
    });
    const removeButton = view.getByRole("button", { name: "Remove USD" });
    removeButton.focus();
    fireEvent.click(removeButton);
    const nextButton = view.getByRole("button", { name: "Remove JPY" });
    const nextFocus = vi.spyOn(nextButton, "focus");
    outsideButton.focus();

    finishCurrencyDeletion("USD", container);

    await new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => resolveFrame());
    });
    expect(nextFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outsideButton);
  });

  it("does not retain a sole deleted row when reduced motion is requested", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const onDelete = vi.fn<(currencyCode: CurrencyCode) => void>();
    render(<StatefulCurrencyList initialItems={["USD"]} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove USD" }));

    expect(onDelete).toHaveBeenCalledWith("USD");
    await waitFor(() => expect(screen.queryByText("USD item 1")).toBeNull());
  });
});

const DEFAULT_ITEMS = ["USD", "JPY", "EUR"] as const;

function renderCurrencyList(
  onReorder: (
    source: CurrencyCode,
    target: CurrencyCode,
    placement: CurrencyDropPlacement,
  ) => void,
  onDelete: (currencyCode: CurrencyCode) => void = () => undefined,
): void {
  render(
    <CurrencyListFixture items={DEFAULT_ITEMS} onDelete={onDelete} onReorder={onReorder} />,
  );
}

function StatefulCurrencyList({
  disableSoleDeletion = false,
  initialItems = DEFAULT_ITEMS,
  onDelete,
}: {
  readonly disableSoleDeletion?: boolean | undefined;
  readonly initialItems?: readonly CurrencyCode[] | undefined;
  readonly onDelete: (currencyCode: CurrencyCode) => void;
}) {
  const [items, setItems] = useState(initialItems);
  return (
    <CurrencyListFixture
      disableSoleDeletion={disableSoleDeletion}
      items={items}
      onDelete={(currencyCode) => {
        onDelete(currencyCode);
        setItems((current) => current.filter((item) => item !== currencyCode));
      }}
      onReorder={createReorderCallback()}
    />
  );
}

function CurrencyListFixture({
  disableSoleDeletion = false,
  items,
  onDelete,
  onReorder,
}: {
  readonly disableSoleDeletion?: boolean | undefined;
  readonly items: readonly CurrencyCode[];
  readonly onDelete: (currencyCode: CurrencyCode) => void;
  readonly onReorder: (
    source: CurrencyCode,
    target: CurrencyCode,
    placement: CurrencyDropPlacement,
  ) => void;
}) {
  return (
    <ReorderableCurrencyList
      ariaLabel="Currencies"
      deleteDisabled={(_item, _index, activeItemCount) =>
        disableSoleDeletion && activeItemCount === 1
      }
      getCurrencyCode={(currencyCode) => currencyCode}
      isDeletable
      isDraggable
      items={items}
      locale="en"
      onDelete={onDelete}
      onReorder={onReorder}
      renderItem={(currencyCode, index, actions) => (
        <CurrencyValueRow
          amount={<span>{String(index + 1)}</span>}
          identity={
            <span>
              {currencyCode} item {index + 1}
            </span>
          }
          currencyCode={currencyCode}
          leadingAction={actions.leadingAction}
          mode="display"
          trailingAction={actions.trailingAction}
        />
      )}
    />
  );
}

function createReorderCallback() {
  return vi.fn<
    (source: CurrencyCode, target: CurrencyCode, placement: CurrencyDropPlacement) => void
  >();
}

/** Gives each row a distinct midpoint for boundary coalescing tests. */
function stubCurrencyRowBounds(): void {
  const rowTops: Readonly<Record<string, number | undefined>> = {
    USD: 0,
    JPY: 20,
    EUR: 40,
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const currencyCode = this.getAttribute("data-list-currency-code");
      const top = currencyCode === null ? 0 : (rowTops[currencyCode] ?? 0);
      return {
        bottom: top + 20,
        height: 20,
        left: 0,
        right: 100,
        toJSON: () => ({}),
        top,
        width: 100,
        x: 0,
        y: top,
      };
    },
  );
}

function createDataTransfer() {
  return {
    dropEffect: "none",
    effectAllowed: "none",
    setData: vi.fn<(format: string, data: string) => void>(),
  };
}

function createDragEvent(
  type: "dragover" | "dragstart" | "drop",
  dataTransfer: object,
  clientY: number,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientY: { value: clientY },
    dataTransfer: { value: dataTransfer },
  });
  return event;
}

/** Adds the related target metadata omitted by happy-dom's drag event constructor. */
function createDragLeaveEvent(relatedTarget: EventTarget): Event {
  const event = new Event("dragleave", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
  return event;
}

/** Creates the transition metadata that happy-dom omits from its event constructor. */
function fireTransitionEnd(element: HTMLElement, propertyName: string): void {
  const event = new Event("transitionend", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}

/** Reads the currently retained visual order from the list's public row markers. */
function getRenderedCurrencies(): readonly string[] {
  return [...screen.getByRole("list", { name: "Currencies" }).children].map(
    (row) => row.getAttribute("data-list-currency-code") ?? "",
  );
}

/** Completes one row's exit through the transition event used by the browser. */
function finishCurrencyDeletion(
  currencyCode: CurrencyCode,
  root: ParentNode = document,
): void {
  const row = root.querySelector(
    `[data-list-currency-code="${currencyCode}"] [data-slot="list-item-row"]`,
  );
  if (!(row instanceof HTMLElement)) {
    throw new TypeError(`Expected the animated ${currencyCode} row content`);
  }
  fireTransitionEnd(row, "translate");
}
