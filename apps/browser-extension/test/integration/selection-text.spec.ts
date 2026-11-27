import { afterEach, describe, expect, it } from "vitest";
import { detectCurrencies } from "@/lib/currency-detection";
import { readSelectionText } from "@/lib/selection-text";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** Renders a price, selects it as a user would, and reads the detected amount. */
function detectSelectedPrice(markup: string): { text: string; amounts: number[] } {
  document.body.innerHTML = `<main><p id="price">${markup}</p></main>`;
  const range = document.createRange();
  range.selectNodeContents(document.querySelector("#price")!);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const text = readSelectionText(selection).trim();
  return {
    text,
    amounts: detectCurrencies(text, { pageLocale: "en-US" }).map(({ amount }) => amount),
  };
}

describe("selected prices with superscript cents in a real browser", () => {
  it("reads superscript cents as the decimal part", () => {
    expect(detectSelectedPrice("$19<sup>99</sup>")).toEqual({
      text: "$19.99",
      amounts: [19.99],
    });
  });

  it("leaves an ordinary price with the same digits before a superscript price", () => {
    expect(detectSelectedPrice("$1999 or $19<sup>99</sup>")).toEqual({
      text: "$1999 or $19.99",
      amounts: [1_999, 19.99],
    });
  });

  it("reads cents raised with vertical-align across separate elements", () => {
    expect(
      detectSelectedPrice(
        '<span>$</span><span>199</span>\n  <span style="vertical-align: super; font-size: 0.6em">00</span>',
      ),
    ).toEqual({ text: "$199.00", amounts: [199] });
  });

  it("keeps a price whose visible and screen-reader copies both have a decimal point", () => {
    expect(
      detectSelectedPrice(
        '<span class="offscreen" style="position: absolute; left: -9999px">$19.99</span><span aria-hidden="true">$19<span>.</span><span style="vertical-align: super">99</span></span>',
      ).amounts,
    ).toEqual([19.99]);
  });

  it("keeps a symbol and an amount in separate blocks", () => {
    expect(
      detectSelectedPrice(
        '<span style="display: block">$</span><span style="display: block">1,234.56</span>',
      ).amounts,
    ).toEqual([1_234.56]);
  });
});
