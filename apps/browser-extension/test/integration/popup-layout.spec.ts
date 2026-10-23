import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  addHostStyle,
  emulateMedia,
  expectEdge,
  openPopupScreen,
  queryAll,
  requireElement,
  saveReviewScreenshot,
  setViewport,
} from "@/test/integration/browser-harness";

const POPUP_PADDING = 16;

beforeEach(async () => {
  await setViewport({ height: 600, width: 420 });
  await emulateMedia({ reducedMotion: "reduce" });
});

describe("popup layout", () => {
  it("reserves the fixed 400-by-600-pixel workspace", async () => {
    await openPopupScreen();
    const popup = requireElement('[data-slot="popup-root"]');

    expect(getComputedStyle(popup).width).toBe("400px");
    expect(getComputedStyle(popup).height).toBe("600px");
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
    const selectBounds = requireElement("select", card).getBoundingClientRect();

    expectEdge(settingsRowBounds.height, 44);
    expectEdge(cardBounds.height, 48);
    expect(labelBounds.left - cardBounds.left).toBe(12);
    expect(cardBounds.right - selectBounds.right).toBe(12);
    expect(selectBounds.top - cardBounds.top).toBe(8);
    expect(cardBounds.bottom - selectBounds.bottom).toBe(8);
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

  it("scales with enlarged text and stays usable on a narrow screen", async () => {
    await setViewport({ height: 700, width: 520 });
    await openPopupScreen();
    addHostStyle("html { font-size: 125%; }");
    const popup = requireElement('[data-slot="popup-root"]');
    await expect.poll(() => getComputedStyle(popup).width).toBe("500px");
    expect(getComputedStyle(popup).height).toBe("700px");
    expect(
      getComputedStyle(page.getByRole("spinbutton", { name: "金額" }).element()).fontSize,
    ).toBe("17.5px");

    await setViewport({ height: 600, width: 320 });
    await expect.poll(() => getComputedStyle(popup).width).toBe("320px");
    expect(getComputedStyle(popup).height).toBe("600px");
    await userEvent.click(page.getByRole("button", { name: "設定を開く" }));
    await userEvent.click(page.getByRole("button", { name: "対応通貨一覧", exact: true }));
    await userEvent.fill(page.getByRole("searchbox", { name: "通貨を検索" }), "ANG");
    const code = page.getByRole("list").getByText("ANG", { exact: true });
    await expect.element(code).toBeVisible();
    expect(getComputedStyle(code.element()).fontSize).toBe("17.5px");
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
  expectEdge(sectionBounds.left - contentBounds.left, POPUP_PADDING);
  expectEdge(contentBounds.right - sectionBounds.right, POPUP_PADDING);
  expectEdge(sectionBounds.top - contentBounds.top, POPUP_PADDING);
  expectEdge(contentBounds.bottom - sectionBounds.bottom, POPUP_PADDING);
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
