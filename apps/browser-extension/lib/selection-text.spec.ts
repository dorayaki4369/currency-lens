// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { readSelectionText } from "@/lib/selection-text";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** Renders markup and selects all of it, or only the element matched by a selector. */
function select(markup: string, selector?: string): Selection {
  document.body.innerHTML = markup;
  const range = document.createRange();
  range.selectNodeContents(
    selector === undefined ? document.body : document.querySelector(selector)!,
  );
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

describe("readSelectionText", () => {
  it("restores the decimal point before superscript cents", () => {
    expect(readSelectionText(select("<p>$19<sup>99</sup></p>"))).toBe("$19.99");
  });

  it("restores the decimal point before cents raised with vertical-align", () => {
    expect(
      readSelectionText(
        select(
          '<p><span>$</span><span>199</span>\n<span style="vertical-align: super">00</span></p>',
        ),
      ),
    ).toBe("$199.00");
  });

  it("finds the whole-unit digits outside the wrapper of the cents", () => {
    expect(
      readSelectionText(select("<p><span>$<b>24</b></span><span><sup>95</sup></span></p>")),
    ).toBe("$24.95");
  });

  it("restores each price in order", () => {
    expect(readSelectionText(select("<p>$19<sup>99</sup> or $1999<sup>99</sup></p>"))).toBe(
      "$19.99 or $1999.99",
    );
  });

  it("keeps text that already has a decimal point or has no superscript cents", () => {
    expect(readSelectionText(select("<p>$19.<sup>99</sup></p>"))).toBe("$19.99");
    expect(readSelectionText(select("<p>$199<sup>1</sup></p>"))).toBe("$1991");
    expect(readSelectionText(select("<p><sup>99</sup></p>"))).toBe("99");
    expect(readSelectionText(select("<p>$19<sup>99</sup></p>", "sup"))).toBe("99");
  });

  it("ignores superscripts outside the selection", () => {
    document.body.innerHTML = "<p><span>$19</span><sup>99</sup></p>";
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("span")!);
    const selection = window.getSelection()!;
    selection.addRange(range);
    expect(readSelectionText(selection)).toBe("$19");
  });

  it("reads a selection without a range or inside detached text", () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    expect(readSelectionText(selection)).toBe("");

    const detached = document.createTextNode("$1999");
    const range = document.createRange();
    range.selectNodeContents(detached);
    expect(
      readSelectionText({
        rangeCount: 1,
        getRangeAt: () => range,
        toString: () => "$1999",
      } as unknown as Selection),
    ).toBe("$1999");
  });
});
