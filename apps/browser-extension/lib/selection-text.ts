// Superscript cents are two digits, as in "$19<sup>99</sup>".
const CENTS_PATTERN = /^\d{2}$/u;
const TRAILING_DIGITS_PATTERN = /\d+$/u;

interface SuperscriptCents {
  /** The whole-unit digits written right before the superscript. */
  readonly whole: string;
  readonly cents: string;
}

/**
 * Reads the selected text, restoring the decimal point that superscript cents leave out.
 * A page may write "$19<sup>99</sup>" for $19.99, which the selection reads as "$1999".
 */
export function readSelectionText(selection: Selection): string {
  const text = selection.toString();
  if (selection.rangeCount === 0) {
    return text;
  }

  return findSuperscriptCents(selection.getRangeAt(0)).reduce(insertDecimalPoint, {
    text,
    cursor: 0,
  }).text;
}

/** Finds two-digit superscripts in a range that directly follow whole-unit digits. */
function findSuperscriptCents(range: Range): SuperscriptCents[] {
  const container = range.commonAncestorContainer;
  const root = container instanceof Element ? container : container.parentElement;
  if (root === null) {
    return [];
  }

  return [root, ...root.querySelectorAll("*")].flatMap((element) => {
    const cents = element.textContent;
    if (
      !CENTS_PATTERN.test(cents) ||
      !range.intersectsNode(element) ||
      !isSuperscript(element)
    ) {
      return [];
    }
    const whole = TRAILING_DIGITS_PATTERN.exec(getPrecedingText(element))?.[0];
    return whole === undefined ? [] : [{ whole, cents }];
  });
}

/** Checks a <sup> element or an element raised with vertical-align: super. */
function isSuperscript(element: Element): boolean {
  return element.localName === "sup" || getComputedStyle(element).verticalAlign === "super";
}

/** Returns the nearest nonempty text before an element, climbing out of wrappers below the root element. */
function getPrecedingText(element: Element): string {
  for (let node = element; node.parentElement !== null; node = node.parentElement) {
    for (
      let sibling = node.previousSibling;
      sibling !== null;
      sibling = sibling.previousSibling
    ) {
      // Below the root element, siblings are elements or character data, whose text is never null.
      const text = sibling.textContent!;
      if (text.trim().length > 0) {
        return text;
      }
    }
  }
  return "";
}

/**
 * Inserts a decimal point between the whole digits and the cents, searching in order.
 * Markup whitespace between the two elements is replaced, as in "$199 00".
 */
function insertDecimalPoint(
  state: { readonly text: string; readonly cursor: number },
  { whole, cents }: SuperscriptCents,
): { readonly text: string; readonly cursor: number } {
  const pattern = new RegExp(String.raw`${whole}\s*${cents}`, "gu");
  pattern.lastIndex = state.cursor;
  const match = pattern.exec(state.text);
  if (match === null) {
    return state;
  }
  const point = match.index + whole.length;
  const centsStart = match.index + match[0].length - cents.length;
  return {
    text: `${state.text.slice(0, point)}.${state.text.slice(centsStart)}`,
    cursor: point + 1 + cents.length,
  };
}
