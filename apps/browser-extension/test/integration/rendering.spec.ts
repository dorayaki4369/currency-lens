import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import {
  addHostStyle,
  emulateMedia,
  findByRole,
  movePointer,
  nextFrames,
  openComponentFixture,
  openConversionScreen,
  openPopupScreen,
  pressPointer,
  queryAll,
  releasePointer,
  rem,
  requireElement,
  setViewport,
  waitForElement,
} from "@/test/integration/browser-harness";

const POPUP_ROUTE_TRANSITION_DURATION_MILLISECONDS = 300;
const ROW_DELETION_SETTLE_MILLISECONDS = 350;
const CONVERSION_SCREEN_VIEWPORT = { height: 820, width: 1_200 } as const;
const SOURCE_AMOUNT_SELECTOR =
  '[data-slot="conversion-editor"] [data-slot="currency-value-row"][data-mode="edit"] [data-slot="currency-amount"]';

beforeEach(async () => {
  await setViewport();
  await emulateMedia({ reducedMotion: "no-preference" });
});

describe("popup route motion", () => {
  it("slides hierarchical routes as one screen and respects reduced motion", async () => {
    await openPopupScreen();

    await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
    await expectPopupRouteTransition("forward");

    await userEvent.click(page.getByRole("button", { name: "外観" }));
    await expectPopupRouteTransition("forward");

    await userEvent.click(page.getByRole("button", { name: "戻る" }));
    await expectPopupRouteTransition("backward");

    await emulateMedia({ reducedMotion: "reduce" });
    await userEvent.click(page.getByRole("button", { name: "対応通貨一覧" }));
    await expect.element(page.getByRole("heading", { name: "対応通貨一覧" })).toBeVisible();
    await expect.poll(() => readPopupRouteAnimations()).toEqual([]);

    await emulateMedia({ reducedMotion: "no-preference" });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
    await userEvent.click(page.getByRole("button", { name: "戻る" }));
    await expectPopupRouteTransition("backward", false);

    await userEvent.click(page.getByRole("button", { name: "外観" }));
    await expectPopupRouteTransition("forward", false);
  });
});

describe("conversion layout", () => {
  it("keeps popup columns aligned when target editing is enabled", async () => {
    await setViewport({ height: 900, width: 420 });
    await openPopupScreen();
    const amount = page.getByRole("spinbutton", { name: "金額" }).element();
    await expect.poll(() => document.activeElement).toBe(amount);

    expectAmountColumnsAligned();
    await enterTargetEditing(1);
    await waitForCurrencyRowTransitions();
    await expectTargetAdderJoinedAndAligned();
  });

  it("keeps conversion-card source and target controls aligned", async () => {
    await setViewport(CONVERSION_SCREEN_VIEWPORT);
    await openConversionScreen();
    await expect.element(page.getByRole("dialog", { name: "換算結果" })).toBeVisible();
    const amount = page.getByRole("spinbutton", { name: "金額" }).element();
    await expect.poll(() => document.activeElement).toBe(amount);

    expectAmountColumnsAligned();
    await enterTargetEditing(1);
    await waitForCurrencyRowTransitions();
    await expectTargetAdderJoinedAndAligned();
  });

  it("keeps the long symbol-settings list's header and columns stable", async () => {
    await setViewport({ height: 600, width: 420 });
    await openPopupScreen();
    await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
    await userEvent.click(page.getByRole("button", { name: "通貨変換設定" }));
    await expect.element(page.getByRole("heading", { name: "通貨変換設定" })).toBeVisible();

    await expectAmbiguousSymbolListLayout();
  });

  it("keeps the in-page card's layout independent of the host root font size", async () => {
    await emulateMedia({ reducedMotion: "reduce" });
    await setViewport(CONVERSION_SCREEN_VIEWPORT);
    const root = await openConversionScreen({ root: "shadow" });
    const dialog = requireElement("dialog", root);
    await expect.element(dialog).toBeVisible();
    const amount = await findByRole("spinbutton", { name: "金額" }, dialog);
    await expect.poll(() => root.activeElement).toBe(amount);
    const expected = readCardDimensions(dialog);

    addHostStyle("html { font-size: 62.5%; }");
    await expect.poll(() => readCardDimensions(dialog)).toEqual(expected);
    addHostStyle("html { font-size: 200%; }");
    await expect.poll(() => readCardDimensions(dialog)).toEqual(expected);
  });
});

describe("shared component layout", () => {
  it("applies real browser layout to default and custom stack gaps", async () => {
    await openComponentFixture("stack");

    const styles = queryAll("[data-fixture-stack]").map((stack) => {
      const style = getComputedStyle(stack);
      return {
        display: style.display,
        flexDirection: style.flexDirection,
        gap: Number.parseFloat(style.rowGap) / rem(1),
        variant: stack.getAttribute("data-fixture-stack"),
      };
    });

    expect(styles).toEqual([
      { display: "flex", flexDirection: "column", gap: 0.5, variant: "default" },
      { display: "flex", flexDirection: "column", gap: 1, variant: "wide" },
      { display: "flex", flexDirection: "column", gap: 0.5, variant: "default" },
      { display: "flex", flexDirection: "column", gap: 1, variant: "wide" },
    ]);
  });

  it("removes the entire add row at the favorite limit", async () => {
    await openComponentFixture("conversion-editor-full");
    await enterTargetEditing(2);
    await waitForCurrencyRowTransitions();

    const editor = requireElement('[data-slot="conversion-editor"]');
    await expect
      .element(await findByRole("button", { name: "換算後の編集を終了" }, editor))
      .toBeVisible();
    expect(queryAll('[data-slot="target-add-row"]', editor)).toHaveLength(0);
  });

  it("disables removal of the final conversion target", async () => {
    await openComponentFixture("conversion-editor-editing");
    await enterTargetEditing(2);
    await waitForCurrencyRowTransitions();

    const removeButtons = page.getByRole("button", { name: "JPY を削除" }).elements();
    expect(removeButtons).toHaveLength(2);
    for (const button of removeButtons) {
      expect(button).toBeDisabled();
    }
  });
});

describe("currency row interaction", () => {
  it("dismisses each non-portalled picker within the extension's ShadowRoot", async () => {
    const root = await openConversionScreen({ root: "shadow" });
    const dialog = requireElement("dialog", root);
    const amountInput = await findByRole("spinbutton", { name: "金額" }, dialog);
    const popoverCount = () => queryAll('[data-slot="popover-content"]', root).length;

    await userEvent.click(await findByRole("combobox", { name: "通貨" }, dialog));
    await expect.poll(popoverCount).toBe(1);
    await userEvent.click(amountInput);
    await expect.poll(popoverCount).toBe(0);
    await expect.poll(() => root.activeElement).toBe(amountInput);

    await userEvent.click(await findByRole("button", { name: "換算後を編集" }, dialog));
    await userEvent.click(await findByRole("combobox", { name: "換算通貨を追加" }, dialog));
    await expect.poll(popoverCount).toBe(1);
    await userEvent.click(amountInput);
    await expect.poll(popoverCount).toBe(0);
    await expect.poll(() => root.activeElement).toBe(amountInput);
  });

  it("updates pointer additions and keyboard reorders without entrance motion", async () => {
    await openPopupScreen();
    const editor = requireElement('[data-slot="conversion-editor"]');
    await userEvent.click(await findByRole("button", { name: "換算後を編集" }, editor));
    await waitForCurrencyRowTransitions();

    await userEvent.click(await findByRole("combobox", { name: "換算通貨を追加" }, editor));
    const picker = await waitForElement('[data-slot="popover-content"]');
    await userEvent.fill(
      await findByRole("combobox", { name: "通貨を検索" }, picker),
      "CAD",
    );
    await userEvent.click(await findByRole("option", { name: /^CAD\b/u }, picker));
    const list = await findByRole("list", { name: "換算後" }, editor);
    const addedRow = await waitForElement(':scope > [data-list-currency-code="CAD"]', list);
    expect(readTargetRowAnimations(addedRow)).toEqual([]);

    (await findByRole("button", { name: /JPY を並べ替え/u }, list)).focus();
    await userEvent.keyboard("{ArrowDown}");
    const reorderedRow = requireElement(':scope > [data-list-currency-code="JPY"]', list);
    expect(readTargetRowAnimations(reorderedRow)).toEqual([]);
  });

  it("drags the whole list row when the browser drag starts from its handle", async () => {
    await openComponentFixture("reorderable-currency-list");
    const list = page.getByRole("list", { name: "換算後の通貨" }).first().element();
    const sourceRow = requireElement(':scope > [data-list-currency-code="JPY"]', list);
    const sourceHandle = requireElement(
      '[data-slot="currency-leading-action"] button',
      sourceRow,
    );
    const targetRow = requireElement(':scope > [data-list-currency-code="EUR"]', list);
    const targetBounds = targetRow.getBoundingClientRect();

    await movePointer(sourceHandle);
    await pressPointer();
    // Chromium starts the native drag on the first move and reports dragover on the next.
    await movePointer(targetRow, { x: targetBounds.width / 2, y: targetBounds.height - 3 });
    await movePointer(targetRow, { x: targetBounds.width / 2, y: targetBounds.height - 2 });

    await expect.poll(() => sourceRow.dataset["dragging"]).toBe("true");
    await expect
      .poll(() => queryAll('[data-slot="currency-drop-indicator"]', list).length)
      .toBe(1);
    await releasePointer();
    await expect.poll(() => sourceRow.dataset["dragging"]).not.toBe("true");
  });

  it("keeps rendered rows still while drag feedback is shown", async () => {
    await openComponentFixture("reorderable-currency-list-dragging");
    const lists = page.getByRole("list", { name: "換算後の通貨" }).elements();
    expect(lists).toHaveLength(2);

    for (const list of lists) {
      // Each themed list is activated and measured before the next one.
      // eslint-disable-next-line no-await-in-loop
      await activateDragIndicatorAndExpectStableRows(list);
    }
  });
});

describe("currency row motion", () => {
  it("moves target rows horizontally while keeping the source amount still", async () => {
    await setViewport(CONVERSION_SCREEN_VIEWPORT);
    await openConversionScreen();
    const editorElement = requireElement('[data-slot="conversion-editor"]');
    await userEvent.click(
      await findByRole("button", { name: "換算後を編集" }, editorElement),
    );
    const list = await findByRole("list", { name: "換算後" }, editorElement);
    const targetRow = requireElement(":scope > li", list);
    const valueRow = requireElement('[data-slot="currency-value-row"]', targetRow);
    await waitForElement('[data-slot="currency-trailing-action"]', valueRow);
    const movement = readCurrencyRowMovement(valueRow);
    const leadingAction = requireElement(
      ':scope > [data-slot="currency-leading-action"]',
      valueRow,
    );
    const trailingAction = requireElement(
      ':scope > [data-slot="currency-trailing-action"]',
      valueRow,
    );

    expect(valueRow.dataset["hasActions"]).toBe("true");
    for (const selector of [
      "[data-currency-icon]",
      '[data-slot="currency-identity"] strong',
      '[data-slot="currency-amount"]',
    ]) {
      expect(requireElement(selector, valueRow)).toBeVisible();
    }
    expect(leadingAction).toBeVisible();
    expect(trailingAction).toBeVisible();
    expectEnteringMovement(movement);

    const reorderBounds = requireElement("button", leadingAction).getBoundingClientRect();
    const removeButtonWidth = requireElement(
      "button",
      trailingAction,
    ).getBoundingClientRect().width;
    expect({ height: reorderBounds.height, width: reorderBounds.width }).toEqual({
      height: 32,
      width: 24,
    });
    expect(reorderBounds.width).toBeLessThan(removeButtonWidth);

    await userEvent.click(
      await findByRole("button", { name: "換算後の編集を終了" }, editorElement),
    );
    expectExitingMovement(readCurrencyRowMovement(valueRow));
    await expect
      .poll(() => queryAll('[data-target-editing-state="exiting"]', editorElement).length)
      .toBe(0);
    expect(queryAll('[data-slot="currency-leading-action"]', editorElement)).toHaveLength(
      0,
    );

    await expectBlankSourceKeepsTargetRows(editorElement);
  });

  it("collapses and slides a deleted conversion-card row before reporting removal", async () => {
    await setViewport(CONVERSION_SCREEN_VIEWPORT);
    await openConversionScreen();
    await expectCurrencyRowDeletionMotion(false);
  });

  it("collapses and slides a deleted popup row before removing it", async () => {
    await openPopupScreen();
    await expectCurrencyRowDeletionMotion(true);
  });

  it("rolls increasing and decreasing values in opposite vertical directions", async () => {
    await openPopupScreen();
    const editor = requireElement('[data-slot="conversion-editor"]');
    const sourceInput = requireElement('input[type="number"]', editor);
    const animatedNumber = requireElement('[data-slot="animated-number"]', editor);
    const direction = () => animatedNumber.dataset["direction"];

    await userEvent.fill(sourceInput, "2");
    await expect.poll(direction).toBe("up");
    const upward = readAnimatedGlyphMovement(animatedNumber);
    expectDescending(upward.outgoingTop);
    expectDescending(upward.incomingTop);
    await expect.poll(direction).toBeUndefined();

    await userEvent.fill(sourceInput, "0.5");
    await expect.poll(direction).toBe("down");
    const downward = readAnimatedGlyphMovement(animatedNumber);
    expectAscending(downward.outgoingTop);
    expectAscending(downward.incomingTop);
    await expect.poll(direction).toBeUndefined();

    await emulateMedia({ reducedMotion: "reduce" });
    await userEvent.fill(sourceInput, "100");
    await expect.poll(direction).toBeUndefined();
    const wideNumberWidth = animatedNumber.getBoundingClientRect().width;
    await userEvent.fill(sourceInput, "1");
    await expect
      .poll(() => animatedNumber.getBoundingClientRect().width)
      .toBeLessThan(wideNumberWidth);
    expect(direction()).toBeUndefined();
    expect(animatedNumber.getAnimations({ subtree: true })).toHaveLength(0);
  });
});

type PopupRouteTransitionDirection = "backward" | "forward";

interface PopupRouteAnimation {
  readonly animationName: string;
  readonly durationMilliseconds: number | null;
  readonly easings: readonly string[];
  readonly pseudoElement: string | null;
  readonly transforms: readonly string[];
}

/** Verifies that old and new route snapshots move together in the requested direction. */
async function expectPopupRouteTransition(
  direction: PopupRouteTransitionDirection,
  usesViewTransition = true,
): Promise<void> {
  const expectedAnimations: readonly PopupRouteAnimation[] = [
    {
      animationName: `popup-route-${direction}-in`,
      durationMilliseconds: POPUP_ROUTE_TRANSITION_DURATION_MILLISECONDS,
      easings: ["ease-in-out", "ease-in-out"],
      pseudoElement: usesViewTransition ? "::view-transition-new(popup-route)" : null,
      transforms:
        direction === "forward"
          ? ["translateX(100%)", "translateX(0px)"]
          : ["translateX(-100%)", "translateX(0px)"],
    },
    {
      animationName: `popup-route-${direction}-out`,
      durationMilliseconds: POPUP_ROUTE_TRANSITION_DURATION_MILLISECONDS,
      easings: ["ease-in-out", "ease-in-out"],
      pseudoElement: usesViewTransition ? "::view-transition-old(popup-route)" : null,
      transforms:
        direction === "forward"
          ? ["translateX(0px)", "translateX(-100%)"]
          : ["translateX(0px)", "translateX(100%)"],
    },
  ];

  await expect
    .poll(() => readPopupRouteAnimations(), { interval: 10 })
    .toEqual(expectedAnimations);
  expect({
    document: window.scrollX,
    popup: requireElement("main").scrollLeft,
  }).toEqual({ document: 0, popup: 0 });
  await expect
    .poll(() => ({
      active: document.documentElement.matches(":active-view-transition"),
      fallbackState: document.documentElement.dataset["popupRouteTransitionState"] ?? null,
      snapshotCount: queryAll("[data-popup-route-snapshot]").length,
    }))
    .toEqual({ active: false, fallbackState: null, snapshotCount: 0 });
}

/** Reads the active CSS animations for both route snapshots. */
function readPopupRouteAnimations(): readonly PopupRouteAnimation[] {
  return document
    .getAnimations()
    .flatMap((animation) => {
      if (
        !(animation instanceof CSSAnimation) ||
        !animation.animationName.startsWith("popup-route-")
      ) {
        return [];
      }
      const effect = animation.effect;
      const duration = effect?.getComputedTiming().duration;
      const keyframes = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
      return [
        {
          animationName: animation.animationName,
          durationMilliseconds: typeof duration === "number" ? duration : null,
          easings: keyframes.map((keyframe) => keyframe.easing),
          pseudoElement: effect instanceof KeyframeEffect ? effect.pseudoElement : null,
          transforms: keyframes.map((keyframe) =>
            typeof keyframe["transform"] === "string" ? keyframe["transform"] : "",
          ),
        },
      ];
    })
    .toSorted((left, right) => left.animationName.localeCompare(right.animationName));
}

/** Reads active row-management transitions without coupling the check to CSS classes. */
function readTargetRowAnimations(row: Element): readonly string[] {
  return queryAll(
    [
      '[data-slot="currency-value-row"]',
      '[data-slot="currency-leading-action"]',
      '[data-slot="currency-trailing-action"]',
    ].join(","),
    row,
  ).flatMap((motionElement) =>
    motionElement.getAnimations().map((animation) => animation.constructor.name),
  );
}

/** Measures the card, field typography, and radius across host-style changes. */
function readCardDimensions(dialog: Element) {
  const field = requireElement("input", dialog);
  const card = requireElement('[data-slot="card"]', dialog);
  return {
    fieldHeight: field.getBoundingClientRect().height,
    fontSize: getComputedStyle(field).fontSize,
    height: dialog.getBoundingClientRect().height,
    radius: getComputedStyle(card).borderRadius,
    width: dialog.getBoundingClientRect().width,
  };
}

/** Verifies source and target amount text share a right edge in display mode. */
function expectAmountColumnsAligned(): void {
  const sourceAmount = requireElement(
    '[data-slot="conversion-editor"] input[type="number"]',
  );
  const targetAmount = requireElement(
    '[data-slot="conversion-editor"] [data-slot="currency-amount"] strong',
  );
  expect(sourceAmount).toBeVisible();
  expect(targetAmount).toBeVisible();

  const sourceStyles = getComputedStyle(sourceAmount);
  const sourcePaddingLeft = Number.parseFloat(sourceStyles.paddingLeft);
  const sourcePaddingRight = Number.parseFloat(sourceStyles.paddingRight);
  const sourceRow = requireClosest(sourceAmount, '[data-slot="currency-value-row"]');
  const targetRow = requireClosest(targetAmount, '[role="listitem"], li');

  expect(Math.abs(sourcePaddingLeft - sourcePaddingRight)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      sourceAmount.getBoundingClientRect().right -
        sourcePaddingRight -
        targetAmount.getBoundingClientRect().right,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      sourceRow.getBoundingClientRect().height - targetRow.getBoundingClientRect().height,
    ),
  ).toBeLessThanOrEqual(1);
  for (const amount of [sourceAmount, targetAmount]) {
    const ratio = readCurrencyValueColumnRatio(
      requireClosest(amount, '[data-slot="currency-value-row"]'),
    );
    expect(Math.abs(ratio - 1.5)).toBeLessThanOrEqual(0.02);
  }
}

/** Measures the rendered name/value column ratio in either row mode. */
function readCurrencyValueColumnRatio(row: Element): number {
  const identity = requireElement('[data-slot="currency-identity"]', row);
  const amount = requireElement('[data-slot="currency-amount"]', row);
  return identity.getBoundingClientRect().width / amount.getBoundingClientRect().width;
}

/** Enters the explicit target-editing state in each rendered fixture copy. */
async function enterTargetEditing(count: number): Promise<void> {
  const editButtons = page.getByRole("button", { name: "換算後を編集" });
  const targetRowSelector =
    '[data-slot="conversion-editor"] [role="list"] > [role="listitem"], [data-slot="conversion-editor"] ol > li';
  expect(editButtons.elements()).toHaveLength(count);
  expect(queryAll(SOURCE_AMOUNT_SELECTOR)).toHaveLength(count);
  const sourceAmountRightEdges = readRightEdges(queryAll(SOURCE_AMOUNT_SELECTOR));
  const targetRowHeights = readHeights(queryAll(targetRowSelector));

  await clickTargetEditButtons(editButtons, count);
  await expect
    .poll(() => page.getByRole("button", { name: "換算後の編集を終了" }).elements().length)
    .toBe(count);

  const editedSourceAmountRightEdges = readRightEdges(queryAll(SOURCE_AMOUNT_SELECTOR));
  expect(editedSourceAmountRightEdges).toHaveLength(sourceAmountRightEdges.length);
  for (const [index, right] of editedSourceAmountRightEdges.entries()) {
    expect(Math.abs(right - (sourceAmountRightEdges[index] ?? 0))).toBeLessThanOrEqual(1);
  }
  expect(readHeights(queryAll(targetRowSelector))).toEqual(targetRowHeights);
  await movePointer(document.body, { x: 0, y: 0 });
  await expect.poll(() => queryAll('[role="tooltip"]').length).toBe(0);
}

/** Clicks each themed edit control sequentially as its shared locator shrinks. */
async function clickTargetEditButtons(buttons: Locator, remaining: number): Promise<void> {
  if (remaining === 0) {
    return;
  }
  await userEvent.click(buttons.first());
  await clickTargetEditButtons(buttons, remaining - 1);
}

/** Reads horizontal endpoints used to catch edit-mode column shifts. */
function readRightEdges(elements: readonly Element[]): readonly number[] {
  return elements.map((element) => element.getBoundingClientRect().right);
}

/** Reads visible row heights to catch vertical shifts when actions are inserted. */
function readHeights(elements: readonly Element[]): readonly number[] {
  return elements.map((element) => element.getBoundingClientRect().height);
}

/** Waits for action-bearing rows to settle before measuring their layout. */
async function waitForCurrencyRowTransitions(): Promise<void> {
  await Promise.all(
    queryAll('[data-slot="currency-value-row"][data-has-actions="true"]')
      .flatMap((row) => row.getAnimations())
      .map((animation) => animation.finished),
  );
}

/** Verifies the add selector fills the final list row without outer padding. */
async function expectTargetAdderJoinedAndAligned(): Promise<void> {
  const editor = requireElement('[data-slot="conversion-editor"]');
  const joinedTargets = queryAll('[data-slot="target-editing-list"]', editor);
  expect(joinedTargets).toHaveLength(1);
  const container = joinedTargets[0];
  if (container === undefined) {
    throw new Error("Joined target list was not rendered");
  }
  expect(
    await findByRole("combobox", { name: "換算通貨を追加" }, container),
  ).toHaveTextContent("換算通貨を追加");

  const list = requireElement(":scope > [role='list'], :scope > ol", container);
  const reveal = requireElement(":scope > [data-slot='target-add-reveal']", container);
  const clip = requireElement(":scope > [data-slot='target-add-clip']", reveal);
  const adder = requireElement(":scope > [data-slot='target-add-row']", clip);
  const combobox = requireElement("[role='combobox']", adder);
  const listBounds = list.getBoundingClientRect();
  const adderBounds = adder.getBoundingClientRect();

  expectWithinPixel(adderBounds.top, listBounds.bottom);
  expectWithinPixel(adderBounds.left, listBounds.left);
  expectWithinPixel(adderBounds.right, listBounds.right);
  for (const element of [combobox, clip, reveal]) {
    const bounds = element.getBoundingClientRect();
    expectWithinPixel(bounds.left, adderBounds.left);
    expectWithinPixel(bounds.right, adderBounds.right);
    expectWithinPixel(bounds.top, adderBounds.top);
    expectWithinPixel(bounds.bottom, adderBounds.bottom);
  }
  await expectTargetAdderPopoverUsable(combobox);
}

/** Verifies the reveal clipping does not block the non-portalled currency picker. */
async function expectTargetAdderPopoverUsable(trigger: HTMLElement): Promise<void> {
  await userEvent.click(trigger);
  await expect
    .poll(() => queryAll('[data-slot="popover-content"]').length)
    .toBeGreaterThan(0);
  const popover = queryAll('[data-slot="popover-content"]').at(-1);
  if (popover === undefined) {
    throw new Error("Target currency picker was not rendered");
  }
  const searchInput = await waitForElement('[data-slot="command-input"]', popover);
  await expect.element(searchInput).toBeVisible();
  const bounds = searchInput.getBoundingClientRect();
  expect(
    document
      .elementsFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      .includes(searchInput),
  ).toBe(true);

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => popover.isConnected).toBe(false);
  await nextFrames();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/** Verifies horizontal rows and confines scrolling below the popup header. */
async function expectAmbiguousSymbolListLayout(): Promise<void> {
  const heading = page.getByRole("heading", { level: 1, name: "通貨変換設定" }).element();
  const list = page.getByRole("list", { name: "通貨変換設定" }).element();
  const rows = queryAll(":scope > li", list);
  expect(rows[0]).toBeVisible();

  const rowLayouts = rows.slice(0, 3).map((row) => {
    const symbolBounds = requireElement(
      '[data-slot="ambiguous-symbols"]',
      row,
    ).getBoundingClientRect();
    const currencyColumn = requireElement('[data-slot="ambiguous-currency"]', row);
    const comboboxBounds = requireElement(
      '[role="combobox"]',
      currencyColumn,
    ).getBoundingClientRect();
    return {
      comboboxCenter: comboboxBounds.top + comboboxBounds.height / 2,
      comboboxLeft: comboboxBounds.left,
      currencyWidth: currencyColumn.getBoundingClientRect().width,
      symbolCenter: symbolBounds.top + symbolBounds.height / 2,
      symbolRight: symbolBounds.right,
      symbolWidth: symbolBounds.width,
    };
  });
  expect(rowLayouts).toHaveLength(3);
  expect(new Set(rowLayouts.map((layout) => layout.comboboxLeft)).size).toBe(1);
  for (const layout of rowLayouts) {
    expect(layout.symbolRight).toBeLessThan(layout.comboboxLeft);
    expect(Math.abs(layout.symbolCenter - layout.comboboxCenter)).toBeLessThanOrEqual(1);
    expect(layout.currencyWidth / layout.symbolWidth).toBeCloseTo(1.5, 1);
  }

  const headingTop = heading.getBoundingClientRect().top;
  list.scrollTop = list.scrollHeight;
  await expect.poll(() => list.scrollTop).toBeGreaterThan(0);
  expect(heading.getBoundingClientRect().top).toBe(headingTop);
  list.scrollTop = 0;
}

/** Activates one themed list's drop indicator and verifies its rows do not move. */
async function activateDragIndicatorAndExpectStableRows(list: Element): Promise<void> {
  const before = readCurrencyRowLayouts(list);
  const source = requireElement(':scope > [data-list-currency-code="JPY"]', list);
  const handle = requireElement('[data-slot="currency-leading-action"] button', source);
  const target = requireElement(':scope > [data-list-currency-code="EUR"]', list);
  expect(source.getAttribute("draggable")).toBe("true");
  expect(handle.getAttribute("draggable")).toBe("false");

  const dataTransfer = new DataTransfer();
  handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
  target.dispatchEvent(
    new DragEvent("dragover", {
      bubbles: true,
      clientY: target.getBoundingClientRect().bottom - 1,
      dataTransfer,
    }),
  );

  await expect.poll(() => target.dataset["dropPlacement"]).toBe("after");
  expect(queryAll('[data-slot="currency-drop-indicator"]', list)).toHaveLength(1);
  expect(readCurrencyRowLayouts(list)).toEqual(before);
}

/** Returns the visible row geometry used to catch drag-feedback layout shifts. */
function readCurrencyRowLayouts(
  list: Element,
): readonly { readonly height: number; readonly top: number }[] {
  return queryAll(":scope > li", list).map((row) => {
    const bounds = row.getBoundingClientRect();
    return { height: bounds.height, top: bounds.top };
  });
}

type Samples = readonly [number, number, number];

interface CurrencyRowMovement {
  readonly actionButtonsHitOutsideFrameAtStart: readonly [boolean, boolean];
  readonly amountRight: Samples;
  readonly identityLeft: Samples;
  readonly leadingActionLeft: Samples;
  readonly opacity: readonly [string, string, string];
  readonly sourceAmountRight: Samples;
  readonly targetAdderBottom: Samples;
  readonly targetAdderTop: Samples;
  readonly targetFrameBottom: Samples;
  readonly trailingActionRight: Samples;
}

/** Verifies the entering row reveals its actions with visible horizontal movement. */
function expectEnteringMovement(movement: CurrencyRowMovement): void {
  expectAscending(movement.identityLeft);
  expectDescending(movement.amountRight);
  expectAscending(movement.leadingActionLeft);
  expectDescending(movement.trailingActionRight);
  expectAscending(movement.targetAdderTop);
  expectAscending(movement.targetFrameBottom);
  expectSharedRowGeometry(movement);
  expect(movement.actionButtonsHitOutsideFrameAtStart).toEqual([false, false]);
}

/** Verifies the exiting row hides its actions by reversing the entering movement. */
function expectExitingMovement(movement: CurrencyRowMovement): void {
  expectDescending(movement.identityLeft);
  expectAscending(movement.amountRight);
  expectDescending(movement.leadingActionLeft);
  expectAscending(movement.trailingActionRight);
  expectDescending(movement.targetAdderTop);
  expectDescending(movement.targetFrameBottom);
  expectSharedRowGeometry(movement);
}

/** Checks properties that stay fixed while target actions enter or exit. */
function expectSharedRowGeometry(movement: CurrencyRowMovement): void {
  const frameToContentOffsets = movement.targetFrameBottom.map(
    (frameBottom, index) => frameBottom - (movement.targetAdderBottom[index] ?? 0),
  );
  expect(
    Math.max(...frameToContentOffsets) - Math.min(...frameToContentOffsets),
  ).toBeLessThanOrEqual(1);
  expect(movement.opacity).toEqual(["1", "1", "1"]);
  for (const right of movement.sourceAmountRight) {
    expect(Math.abs(right - movement.sourceAmountRight[0])).toBeLessThanOrEqual(1);
  }
}

/** Samples every row transition at the same absolute start, midpoint, and end time. */
function readCurrencyRowMovement(row: HTMLElement): CurrencyRowMovement {
  const identity = requireElement("[data-currency-icon]", row);
  const amount = requireElement('[data-slot="currency-amount"]', row);
  const leadingAction = requireElement('[data-slot="currency-leading-action"]', row);
  const trailingAction = requireElement('[data-slot="currency-trailing-action"]', row);
  const editor = requireClosest(row, '[data-slot="conversion-editor"]');
  const targetEditingFrame = requireElement('[data-slot="target-editing-list"]', editor);
  const targetAdder = requireElement('[data-slot="target-add-row"]', editor);
  const sourceAmount = requireElement(
    '[data-slot="currency-value-row"][data-mode="edit"] [data-slot="currency-amount"]',
    editor,
  );
  const leadingButton = requireElement("button", leadingAction);
  const trailingButton = requireElement("button", trailingAction);
  let actionButtonsHitOutsideFrameAtStart: readonly [boolean, boolean] = [false, false];

  const samples = sampleTransitions(editor, (sampleIndex) => {
    if (sampleIndex === 0) {
      actionButtonsHitOutsideFrameAtStart = readOutsideFrameHitState();
    }
    const targetAdderBounds = targetAdder.getBoundingClientRect();
    return {
      amountRight: amount.getBoundingClientRect().right,
      identityLeft: identity.getBoundingClientRect().left,
      leadingActionLeft: leadingAction.getBoundingClientRect().left,
      opacity: getComputedStyle(row).opacity,
      sourceAmountRight: sourceAmount.getBoundingClientRect().right,
      targetAdderBottom: targetAdderBounds.bottom,
      targetAdderTop: targetAdderBounds.top,
      targetFrameBottom: targetEditingFrame.getBoundingClientRect().bottom,
      trailingActionRight: trailingAction.getBoundingClientRect().right,
    };
  });
  const pick = <T>(read: (sample: (typeof samples)[number]) => T): readonly [T, T, T] => [
    read(samples[0]),
    read(samples[1]),
    read(samples[2]),
  ];

  return {
    actionButtonsHitOutsideFrameAtStart,
    amountRight: pick((sample) => sample.amountRight),
    identityLeft: pick((sample) => sample.identityLeft),
    leadingActionLeft: pick((sample) => sample.leadingActionLeft),
    opacity: pick((sample) => sample.opacity),
    sourceAmountRight: pick((sample) => sample.sourceAmountRight),
    targetAdderBottom: pick((sample) => sample.targetAdderBottom),
    targetAdderTop: pick((sample) => sample.targetAdderTop),
    targetFrameBottom: pick((sample) => sample.targetFrameBottom),
    trailingActionRight: pick((sample) => sample.trailingActionRight),
  };

  /** Detects whether either action remains hit-testable outside the list frame. */
  function readOutsideFrameHitState(): readonly [boolean, boolean] {
    const frameBounds = targetEditingFrame.getBoundingClientRect();
    const leadingBounds = leadingButton.getBoundingClientRect();
    const trailingBounds = trailingButton.getBoundingClientRect();
    return [
      document
        .elementsFromPoint(
          frameBounds.left - 1,
          leadingBounds.top + leadingBounds.height / 2,
        )
        .some((element) => leadingButton.contains(element)),
      document
        .elementsFromPoint(
          frameBounds.right + 1,
          trailingBounds.top + trailingBounds.height / 2,
        )
        .some((element) => trailingButton.contains(element)),
    ];
  }
}

/** Verifies deletion collapses and slides the entire row before removal is reported. */
async function expectCurrencyRowDeletionMotion(removesItem: boolean): Promise<void> {
  const editor = requireElement('[data-slot="conversion-editor"]');
  await userEvent.click(await findByRole("button", { name: "換算後を編集" }, editor));
  const list = await findByRole("list", { name: "換算後" }, editor);
  const row = requireElement(':scope > [data-list-currency-code="JPY"]', list);
  const reveal = requireElement('[data-slot="list-item-reveal"]', row);
  await expect.element(row).toBeVisible();
  await new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, ROW_DELETION_SETTLE_MILLISECONDS);
  });

  await userEvent.click(await findByRole("button", { name: "JPY を削除" }, row));
  expect(row.dataset["deleteState"]).toBe("exiting");
  const content = requireElement('[data-slot="list-item-row"]', reveal);
  const samples = sampleTransitions(reveal, () => ({
    contentTop: content.getBoundingClientRect().top,
    revealHeight: reveal.getBoundingClientRect().height,
  }));

  expectDescending([samples[0].contentTop, samples[1].contentTop, samples[2].contentTop]);
  expectDescending([
    samples[0].revealHeight,
    samples[1].revealHeight,
    samples[2].revealHeight,
  ]);
  if (removesItem) {
    await expect.poll(() => row.isConnected).toBe(false);
  } else {
    await expect.poll(() => row.dataset["deleteState"]).not.toBe("exiting");
  }
}

/** Verifies an empty source changes only target amounts, never target identities. */
async function expectBlankSourceKeepsTargetRows(editorElement: HTMLElement): Promise<void> {
  const list = await findByRole("list", { name: "換算後" }, editorElement);
  const readTargetCodes = () =>
    queryAll(":scope > li", list).map((row) =>
      row.querySelector("[data-currency-code]")?.getAttribute("data-currency-code"),
    );
  const targetCodes = readTargetCodes();
  expect(targetCodes.length).toBeGreaterThan(0);
  expect(targetCodes).not.toContain(undefined);

  await userEvent.fill(requireElement('input[type="number"]', editorElement), "");

  await expect
    .element(await findByRole("heading", { name: "換算後" }, editorElement))
    .toBeVisible();
  expect(readTargetCodes()).toEqual(targetCodes);
  await expect
    .poll(() =>
      queryAll(':scope > li [data-slot="currency-amount"]', list).map(
        (amount) => amount.textContent,
      ),
    )
    .toEqual(targetCodes.map(() => "-"));
}

interface AnimatedGlyphMovement {
  readonly incomingTop: Samples;
  readonly outgoingTop: Samples;
}

/** Samples one changed reel glyph at shared absolute points in its transition timeline. */
function readAnimatedGlyphMovement(number: HTMLElement): AnimatedGlyphMovement {
  const incoming = requireElement('[data-slot="animated-number-incoming"]', number);
  const outgoing = requireElement(
    '[data-slot="animated-number-outgoing"]',
    incoming.parentElement ?? number,
  );
  const samples = sampleTransitions(number, () => ({
    incomingTop: incoming.getBoundingClientRect().top,
    outgoingTop: outgoing.getBoundingClientRect().top,
  }));
  return {
    incomingTop: [samples[0].incomingTop, samples[1].incomingTop, samples[2].incomingTop],
    outgoingTop: [samples[0].outgoingTop, samples[1].outgoingTop, samples[2].outgoingTop],
  };
}

/** Pauses a subtree's transitions and reads it at their start, midpoint, and end. */
function sampleTransitions<T>(
  element: Element,
  read: (sampleIndex: number) => T,
): readonly [T, T, T] {
  const transitions = element.getAnimations({ subtree: true });
  if (transitions.length === 0) {
    throw new Error(`Transitions did not start for ${element.outerHTML.slice(0, 120)}`);
  }
  for (const transition of transitions) {
    transition.pause();
  }
  const durations = transitions.map((transition) => {
    const duration = transition.effect?.getTiming().duration;
    if (typeof duration !== "number") {
      throw new TypeError("Transition duration is not numeric");
    }
    return duration;
  });
  const transitionEnd = Math.max(...durations);
  const sampleAt = (elapsed: number, sampleIndex: number): T => {
    transitions.forEach((transition, index) => {
      transition.currentTime = Math.min(elapsed, durations[index] ?? 0);
    });
    return read(sampleIndex);
  };
  const samples = [
    sampleAt(0, 0),
    sampleAt(transitionEnd / 2, 1),
    sampleAt(transitionEnd, 2),
  ] as const;
  for (const transition of transitions) {
    transition.finish();
  }
  return samples;
}

/** Returns the nearest matching ancestor and fails when the structure is missing. */
function requireClosest(element: Element, selector: string): HTMLElement {
  const match = element.closest<HTMLElement>(selector);
  if (match === null) {
    throw new Error(`Ancestor was not rendered: ${selector}`);
  }
  return match;
}

/** Asserts three samples strictly increase. */
function expectAscending(samples: Samples): void {
  expect(samples[0]).toBeLessThan(samples[1]);
  expect(samples[1]).toBeLessThan(samples[2]);
}

/** Asserts three samples strictly decrease. */
function expectDescending(samples: Samples): void {
  expect(samples[0]).toBeGreaterThan(samples[1]);
  expect(samples[1]).toBeGreaterThan(samples[2]);
}

/** Compares two rendered coordinates with one pixel of rounding tolerance. */
function expectWithinPixel(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}
