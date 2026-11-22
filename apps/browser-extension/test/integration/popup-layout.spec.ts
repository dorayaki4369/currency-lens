import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  addHostStyle,
  emulateMedia,
  expectEdge,
  openPopupScreen,
  queryAll,
  rem,
  requireElement,
  saveReviewScreenshot,
  setViewport,
} from "@/test/integration/browser-harness";

const POPUP_PADDING_REM = 1;

beforeEach(async () => {
  await setViewport({ height: 600, width: 420 });
  await emulateMedia({ reducedMotion: "reduce" });
});

describe("popup layout", () => {
  it("reserves the fixed 25-by-37.5-rem workspace", async () => {
    await openPopupScreen();
    const popupBounds = requireElement('[data-slot="popup-root"]').getBoundingClientRect();

    expectEdge(popupBounds.width, rem(25));
    expectEdge(popupBounds.height, rem(37.5));
  });

  it("keeps the target currency menu fully usable inside the popup", async () => {
    await openPopupScreen();
    const popup = requireElement("main");
    const editor = requireElement('[data-slot="conversion-editor"]');
    await userEvent.click(
      page.elementLocator(editor).getByRole("button", { name: "換算後を編集" }),
    );
    await userEvent.click(
      page.elementLocator(editor).getByRole("combobox", { name: "換算通貨を追加" }),
    );
    await expect
      .poll(() => queryAll('[data-slot="popover-content"]').length)
      .toBeGreaterThan(0);
    const picker = queryAll('[data-slot="popover-content"]').at(-1);
    if (picker === undefined) {
      throw new Error("Target currency menu was not rendered");
    }
    await expect.element(picker).toBeVisible();

    const popupBounds = popup.getBoundingClientRect();
    const pickerBounds = picker.getBoundingClientRect();
    expect(pickerBounds.top).toBeGreaterThanOrEqual(popupBounds.top);
    expect(pickerBounds.bottom).toBeLessThanOrEqual(popupBounds.bottom);
    expect(pickerBounds.left).toBeGreaterThanOrEqual(popupBounds.left);
    expect(pickerBounds.right).toBeLessThanOrEqual(popupBounds.right);
    expect(popup.scrollTop).toBe(0);

    const pickerLocator = page.elementLocator(picker);
    await userEvent.fill(
      pickerLocator.getByRole("combobox", { name: "通貨を検索" }),
      "CAD",
    );
    await expect
      .element(pickerLocator.getByRole("option", { name: /^CAD\b/u }))
      .toBeVisible();
  });

  it("matches the theme row to the density of other settings rows", async () => {
    await openPopupScreen();
    await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
    const settingsRow = page.getByRole("button", { name: "外観" });
    await expect.element(settingsRow).toBeVisible();
    const settingsRowBounds = settingsRow.element().getBoundingClientRect();
    await userEvent.click(settingsRow);
    await expect.element(page.getByRole("heading", { name: "外観" })).toBeVisible();

    const card = requireElement('[data-slot="card"]');
    const cardBounds = card.getBoundingClientRect();
    const labelBounds = requireElement("label", card).getBoundingClientRect();
    const selectBounds = requireElement(
      '[data-slot="segmented-control"]',
      card,
    ).getBoundingClientRect();

    expectEdge(settingsRowBounds.height, rem(2.75));
    expectEdge(cardBounds.height, rem(3));
    expectEdge(labelBounds.left - cardBounds.left, rem(0.75));
    expectEdge(cardBounds.right - selectBounds.right, rem(0.75));
    expectEdge(selectBounds.top - cardBounds.top, rem(0.5));
    expectEdge(cardBounds.bottom - selectBounds.bottom, rem(0.5));

    const thumb = requireElement('[data-slot="segmented-control-thumb"]', card);
    await userEvent.click(page.getByRole("radio", { name: "ダーク" }));
    const dark = page.getByRole("radio", { name: "ダーク" }).element();
    // The thumb moves after React re-renders from the observer, so wait for it to settle on the item.
    await expect
      .poll(() => {
        const thumbBounds = thumb.getBoundingClientRect();
        const darkBounds = dark.getBoundingClientRect();
        return (
          thumb.getAnimations().length === 0 &&
          Math.abs(thumbBounds.left - darkBounds.left) < 0.5 &&
          Math.abs(thumbBounds.width - darkBounds.width) < 0.5
        );
      })
      .toBe(true);
  });

  it("keeps the header in place while a long route body scrolls", async () => {
    await openSettingsRoute("このアプリについて");
    const popup = requireElement("main");
    const body = requireElement('[data-slot="popup-route-body"]');
    const header = requireElement("header");
    const headerTop = header.getBoundingClientRect().top;

    // Force the body to overflow regardless of copy length, then scroll it to the end.
    body.style.maxHeight = `${rem(10)}px`;
    body.scrollTop = body.scrollHeight;

    expect(body.scrollTop).toBeGreaterThan(0);
    expect(popup.scrollHeight).toBe(popup.clientHeight);
    expectEdge(header.getBoundingClientRect().top, headerTop);
  });

  it("lets the symbol list consume the height left below its description", async () => {
    await openSettingsRoute("通貨変換設定");
    const section = requireElement('section[aria-labelledby="symbol-settings-title"]');
    const sectionBounds = expectPopupSectionUsesUniformPadding(section);
    const list = requireElement('[data-slot="list"]', section);

    expectEdge(list.getBoundingClientRect().bottom, sectionBounds.bottom);
    await expectListScrollsInternally(list);
  });

  it("aligns the catalog search and list while the list scrolls internally", async () => {
    await openSettingsRoute("対応通貨一覧");
    const section = requireElement('section[aria-labelledby="currencies-title"]');
    const sectionBounds = expectPopupSectionUsesUniformPadding(section);
    const listBounds = requireElement(
      '[data-slot="list"]',
      section,
    ).getBoundingClientRect();
    const searchBounds = page
      .elementLocator(section)
      .getByRole("searchbox", { name: "通貨を検索" })
      .element()
      .getBoundingClientRect();

    expectEdge(listBounds.bottom, sectionBounds.bottom);
    expectEdge(listBounds.left, searchBounds.left);
    expectEdge(listBounds.right, searchBounds.right);
    await expectListScrollsInternally(requireElement('[data-slot="list"]', section));
  });

  it("uses the same typography and icon spacing for every currency presentation", async () => {
    await openPopupScreen();
    const identitySelector = '[data-slot="currency-identity-label"]';
    const source = page.getByRole("combobox", { name: "通貨", exact: true });
    const identity = requireElement(identitySelector, source.element());
    const expected = readIdentityStyle(identity);
    await userEvent.click(source);
    await expect.poll(() => queryAll(identitySelector).length).toBeGreaterThan(4);
    expect(queryAll(identitySelector).map(readIdentityStyle)).toEqual(
      queryAll(identitySelector).map(() => expected),
    );

    await userEvent.keyboard("{Escape}");
    await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
    await userEvent.click(page.getByRole("button", { name: "対応通貨一覧", exact: true }));
    await expect
      .poll(() => {
        const first = document.querySelector<HTMLElement>(identitySelector);
        return first === null ? null : readIdentityStyle(first);
      })
      .toEqual(expected);
  });

  it("lines up target sparklines after the widest name and pins amounts to the right", async () => {
    await openPopupScreen();
    expectTargetRowsAligned(3);

    await setViewport({ height: 600, width: 320 });
    await userEvent.click(page.getByRole("button", { name: "換算後を編集" }));
    await userEvent.click(page.getByRole("combobox", { name: "換算通貨を追加" }));
    await userEvent.fill(page.getByRole("combobox", { name: "通貨を検索" }), "BAM");
    await userEvent.click(page.getByRole("option", { name: /^BAM\b/u }));
    await userEvent.click(page.getByRole("button", { name: "換算後の編集を終了" }));
    await expect.poll(() => queryAll('[data-slot="sparkline"]').length).toBe(4);
    const popup = requireElement('[data-slot="popup-root"]');
    expect(popup.scrollWidth > popup.clientWidth).toBe(false);
    expectTargetRowsAligned(4);
    await saveReviewScreenshot("popup-narrow-long-target-name");
  });

  it("keeps the rates heading where the converter's is and sizes both rate choices alike", async () => {
    await openPopupScreen();
    const targetsRow = requireHeadingRow("換算後");

    await userEvent.click(page.getByRole("radio", { name: "レート", exact: true }));
    await expect.poll(() => queryAll('[data-slot="rate-chart-tag"]').length).toBe(3);
    const ratesRow = requireHeadingRow("レート");
    expectEdge(ratesRow.height, targetsRow.height);
    expectEdge(ratesRow.top, targetsRow.top);

    const currencyChoice = requireSegmentedBounds("表示する通貨");
    const periodChoice = requireSegmentedBounds("期間");
    expectEdge(periodChoice.group.height, currencyChoice.group.height);
    expectEdge(periodChoice.thumb.height, currencyChoice.thumb.height);
    expectEdge(periodChoice.thumb.top - periodChoice.group.top, 2);
  });

  it("keeps the right axis one left-aligned column of fixed width per chart mode", async () => {
    await openPopupScreen();
    await userEvent.click(page.getByRole("radio", { name: "レート", exact: true }));
    await expect.poll(() => queryAll('[data-slot="rate-chart-tag"]').length).toBe(3);
    const percentAxis = expectAlignedRightAxis();

    // Periods change how many digits the changes have; the column must not follow them.
    for (const period of ["1日", "5日", "6か月", "YTD", "1年"]) {
      /* eslint-disable no-await-in-loop */
      await userEvent.click(page.getByRole("radio", { name: period, exact: true }));
      await expect
        .element(page.getByRole("slider"))
        .toHaveAccessibleName(new RegExp(`過去${period}|${period}`, "u"));
      /* eslint-enable no-await-in-loop */
      expectEdge(expectAlignedRightAxis(), percentAxis);
    }

    await userEvent.click(page.getByRole("radio", { name: "JPY", exact: true }));
    await expect.poll(() => queryAll('[data-slot="rate-chart-tag"]').length).toBe(1);
    const rateAxis = expectAlignedRightAxis();
    await userEvent.click(page.getByRole("radio", { name: "EUR", exact: true }));
    await expect.element(page.getByRole("slider")).toHaveAccessibleName(/EUR/u);
    expectEdge(expectAlignedRightAxis(), rateAxis);
  });

  it("keeps the rate chart, its axis tags, and the legend inside the card", async () => {
    for (const width of [420, 320]) {
      // Each width mounts a fresh popup, so the checks must run in order.
      /* eslint-disable no-await-in-loop */
      await setViewport({ height: 600, width });
      await openPopupScreen();
      await userEvent.click(page.getByRole("radio", { name: "レート", exact: true }));
      await expect.poll(() => queryAll('[data-slot="rate-chart-tag"]').length).toBe(3);
      /* eslint-enable no-await-in-loop */
      expectRateCardContained();
    }
    await saveReviewScreenshot("popup-rates-narrow");

    await userEvent.click(page.getByRole("radio", { name: "GBP", exact: true }));
    await expect.poll(() => queryAll('[data-slot="rate-chart-tag"]').length).toBe(1);
    expectRateCardContained();
  });

  it("opens a target's chart from its sparkline and moves the cursor by pointer and key", async () => {
    await openPopupScreen();
    await userEvent.click(page.getByRole("button", { name: "EUR のレートを開く" }));
    const chart = page.getByRole("slider", {
      name: "USD に対する EUR のチャート（過去1か月）",
    });
    await expect.element(chart).toBeVisible();
    const ratesToggle = page.getByRole("radio", { name: "レート", exact: true });
    await expect.element(ratesToggle).toHaveAttribute("aria-checked", "true");
    await expect.element(ratesToggle).toHaveFocus();
    await expect
      .element(page.getByRole("radio", { name: "EUR", exact: true }))
      .toHaveAttribute("aria-checked", "true");

    const plot = chart.element();
    const bounds = plot.getBoundingClientRect();
    await userEvent.hover(plot, { position: { x: bounds.width * 0.25, y: 40 } });
    await expect.poll(() => queryAll('[data-slot="rate-chart-dot"]').length).toBe(1);
    const tooltip = requireElement('[data-slot="rate-chart-tooltip"]');
    expect(tooltip.getBoundingClientRect().left).toBeGreaterThan(
      bounds.left + bounds.width * 0.25,
    );
    await saveReviewScreenshot("popup-rates-cursor");

    await userEvent.unhover(plot);
    await expect.poll(() => queryAll('[data-slot="rate-chart-tooltip"]').length).toBe(0);
    plot.focus();
    const lastIndex = plot.getAttribute("aria-valuemax");
    await expect.element(chart).toHaveAttribute("aria-valuenow", lastIndex);
    await userEvent.keyboard("{ArrowLeft}");
    await expect
      .element(chart)
      .toHaveAttribute("aria-valuenow", String(Number(lastIndex) - 1));
    expect(queryAll('[data-slot="rate-chart-tooltip"]')).toHaveLength(1);

    await userEvent.click(page.getByRole("radio", { name: "換算", exact: true }));
    await expect
      .element(page.getByRole("radio", { name: "換算", exact: true }))
      .toHaveFocus();
  });

  it("scales with enlarged text and stays usable on a narrow screen", async () => {
    await setViewport({ height: 700, width: 520 });
    await openPopupScreen();
    addHostStyle("html { font-size: 125%; }");
    const popup = requireElement('[data-slot="popup-root"]');
    await expect.poll(() => popup.getBoundingClientRect().width).toBeCloseTo(rem(25), 0);
    // 37.5rem exceeds this viewport, so the height is capped by the viewport.
    expectEdge(popup.getBoundingClientRect().height, window.innerHeight);
    expectFontSize(page.getByRole("spinbutton", { name: "金額" }).element(), 0.875);

    await setViewport({ height: 600, width: 320 });
    await expect
      .poll(() => popup.getBoundingClientRect().width)
      .toBeCloseTo(window.innerWidth, 0);
    expectEdge(popup.getBoundingClientRect().height, window.innerHeight);
    await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
    await userEvent.click(page.getByRole("button", { name: "対応通貨一覧", exact: true }));
    await userEvent.fill(page.getByRole("searchbox", { name: "通貨を検索" }), "ANG");
    const code = page.getByRole("list").getByText("ANG", { exact: true });
    await expect.element(code).toBeVisible();
    expectFontSize(code.element(), 0.875);
    expect(popup.scrollWidth > popup.clientWidth).toBe(false);
    await saveReviewScreenshot("popup-narrow-enlarged-text");
  });
});

interface IdentityStyle {
  readonly fontSize: string;
  readonly gap: string;
}

/** Reads the typography that every currency identity must share. */
function readIdentityStyle(element: Element): IdentityStyle {
  const style = getComputedStyle(element);
  return { fontSize: style.fontSize, gap: style.columnGap };
}

/** Opens one localized settings detail route from a fresh popup. */
async function openSettingsRoute(routeName: string): Promise<void> {
  await openPopupScreen();
  await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
  await userEvent.click(page.getByRole("button", { name: routeName }));
  await expect.element(page.getByRole("heading", { name: routeName })).toBeVisible();
}

/** Verifies sparklines share one column 12 px after the names and amounts end together. */
function expectTargetRowsAligned(rowCount: number): void {
  const list = requireElement('[data-slot="list"]');
  const listBounds = list.getBoundingClientRect();
  const rows = queryAll('[data-slot="currency-value-content"]', list);
  expect(rows).toHaveLength(rowCount);
  const [firstRow] = rows;
  if (firstRow === undefined) {
    throw new Error("Target rows were not rendered");
  }
  const sparklineLeft = requireElement(
    '[data-slot="sparkline"]',
    firstRow,
  ).getBoundingClientRect().left;
  for (const row of rows) {
    const identity = requireElement(
      '[data-slot="currency-identity"]',
      row,
    ).getBoundingClientRect();
    const sparkline = requireElement(
      '[data-slot="sparkline"]',
      row,
    ).getBoundingClientRect();
    const amount = requireElement(
      '[data-slot="currency-amount"]',
      row,
    ).getBoundingClientRect();
    expectEdge(identity.left - listBounds.left, rem(0.75));
    expectEdge(sparkline.left, sparklineLeft);
    expectEdge(sparkline.left - identity.right, rem(0.75));
    expectEdge(sparkline.width, rem(5));
    expectEdge(listBounds.right - amount.right, rem(0.75));
    expect(amount.width).toBeGreaterThanOrEqual(rem(4.5) - 0.5);
  }
}

/** Verifies the rate card's chart parts stay inside it and its axis tags never overlap. */
function expectRateCardContained(): void {
  const popup = requireElement('[data-slot="popup-root"]');
  const card = requireElement('[data-slot="rate-card"]').getBoundingClientRect();
  const plot = requireElement('[data-slot="rate-chart-plot"]').getBoundingClientRect();
  const axis = requireElement('[data-slot="rate-chart-y-axis"]').getBoundingClientRect();
  const legend = document
    .querySelector('[data-slot="rate-legend"]')
    ?.getBoundingClientRect();
  const tags = queryAll('[data-slot="rate-chart-tag"]')
    .map((tag) => tag.getBoundingClientRect())
    .toSorted((first, second) => first.top - second.top);

  expect(popup.scrollWidth > popup.clientWidth).toBe(false);
  expect(axis.right).toBeLessThanOrEqual(card.right);
  expect(plot.left).toBeGreaterThanOrEqual(card.left);
  if (legend !== undefined) {
    expect(legend.right).toBeLessThanOrEqual(card.right);
  }
  tags.forEach((tag, index) => {
    expect(tag.top).toBeGreaterThanOrEqual(plot.top - 0.5);
    expect(tag.bottom).toBeLessThanOrEqual(plot.bottom + 0.5);
    expect(tag.right).toBeLessThanOrEqual(card.right);
    const previous = tags[index - 1];
    if (previous !== undefined) {
      expect(tag.top).toBeGreaterThanOrEqual(previous.bottom);
    }
  });
}

/** Verifies a route fills the popup and applies the shared inset on all four sides. */
function expectPopupSectionUsesUniformPadding(section: HTMLElement): DOMRect {
  const popup = requireElement('[data-slot="popup-root"]');
  const popupBounds = popup.getBoundingClientRect();
  const route = requireElement('[data-slot="popup-route"]');
  const headerBounds = requireElement(":scope > header", route).getBoundingClientRect();
  const content = section.parentElement;
  if (content === null) {
    throw new Error("Popup section content was not rendered");
  }
  const contentBounds = content.getBoundingClientRect();
  const sectionBounds = section.getBoundingClientRect();

  expectEdge(route.getBoundingClientRect().height, popupBounds.height);
  expectEdge(contentBounds.top, headerBounds.bottom);
  expectEdge(contentBounds.bottom, popupBounds.bottom);
  expectEdge(sectionBounds.left - contentBounds.left, rem(POPUP_PADDING_REM));
  expectEdge(contentBounds.right - sectionBounds.right, rem(POPUP_PADDING_REM));
  expectEdge(sectionBounds.top - contentBounds.top, rem(POPUP_PADDING_REM));
  expectEdge(contentBounds.bottom - sectionBounds.bottom, rem(POPUP_PADDING_REM));
  expect(popup.scrollHeight).toBe(popup.clientHeight);

  return sectionBounds;
}

/** Verifies wheel input stays within the list and can reveal its final row. */
async function expectListScrollsInternally(list: HTMLElement): Promise<void> {
  expect(getComputedStyle(list).overflowY).toBe("auto");
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  await userEvent.wheel(list, { delta: { y: list.scrollHeight } });
  await expect.poll(() => list.scrollTop).toBeGreaterThan(0);

  const listBounds = list.getBoundingClientRect();
  const lastItem = queryAll(':scope > [data-slot="list-item"]', list).at(-1);
  if (lastItem === undefined) {
    throw new Error("List items were not rendered");
  }
  const lastItemBounds = lastItem.getBoundingClientRect();
  expect(lastItemBounds.top).toBeGreaterThanOrEqual(listBounds.top - 1);
  expect(lastItemBounds.bottom).toBeLessThanOrEqual(listBounds.bottom + 1);
}

/** Verifies text follows the root font size instead of a fixed pixel size. */
function expectFontSize(element: Element, expectedRem: number): void {
  expect(Number.parseFloat(getComputedStyle(element).fontSize)).toBeCloseTo(
    rem(expectedRem),
    1,
  );
}

/** Measures the row that holds a section heading and its optional action. */
function requireHeadingRow(name: string): DOMRect {
  const row = page.getByRole("heading", { name, exact: true }).element().parentElement;
  if (row === null) {
    throw new Error(`Heading row was not rendered: ${name}`);
  }
  return row.getBoundingClientRect();
}

/** Measures a segmented control and its sliding thumb. */
function requireSegmentedBounds(groupName: string): { group: DOMRect; thumb: DOMRect } {
  const group = page.getByRole("radiogroup", { name: groupName }).element();
  return {
    group: group.getBoundingClientRect(),
    thumb: requireElement(
      '[data-slot="segmented-control-thumb"]',
      group,
    ).getBoundingClientRect(),
  };
}

/**
 * Checks that every axis tag spans the same width and that tag and tick text start at one x,
 * then returns the axis column's width.
 */
function expectAlignedRightAxis(): number {
  const axis = requireElement('[data-slot="rate-chart-y-axis"]');
  const tags = queryAll('[data-slot="rate-chart-tag"]');
  const ticks = [...axis.querySelectorAll<HTMLElement>(":scope > span:not([data-slot])")];
  expect(ticks.length).toBeGreaterThan(0);
  const tagWidths = tags.map((tag) => tag.getBoundingClientRect().width);
  for (const width of tagWidths) {
    expectEdge(width, tagWidths[0]!);
  }
  const tickStart = readTextStart(ticks[0]!);
  for (const label of [...tags, ...ticks]) {
    expectEdge(readTextStart(label), tickStart);
  }
  return axis.getBoundingClientRect().width;
}

/** Measures where an element's text begins, inside any padding. */
function readTextStart(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().left;
}
