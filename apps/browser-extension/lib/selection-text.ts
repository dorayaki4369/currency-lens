// Superscript cents are two digits, as in "$19<sup>99</sup>".
const CENTS_LENGTH = 2;
const CENTS_PATTERN = /^\d{2}$/u;
const TRAILING_DIGITS_PATTERN = /\d+$/u;

interface SuperscriptCents {
  /** Matches the whole-unit digits written right before the superscript, then the cents. */
  readonly pattern: RegExp;
  readonly wholeLength: number;
  /** Which match of the pattern in the selected text belongs to this superscript, from 1. */
  readonly occurrence: number;
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

  // Later prices go first, so an inserted point never shifts an earlier occurrence count.
  return findSuperscriptCents(selection.getRangeAt(0))
    .toReversed()
    .reduce(insertDecimalPoint, text);
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
    if (whole === undefined) {
      return [];
    }
    // Markup whitespace may separate the elements, as in "$199 00".
    const pattern = new RegExp(String.raw`${whole}\s*${cents}`, "gu");
    // Counting the same digits before the superscript tells an ordinary "$1999" earlier in the
    // selection apart from the price written as "$19<sup>99</sup>".
    const before = range.cloneRange();
    before.setEndBefore(element);
    const occurrence = [...`${before.toString()}${cents}`.matchAll(pattern)].length;
    return occurrence === 0 ? [] : [{ pattern, wholeLength: whole.length, occurrence }];
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

/** Inserts a decimal point between the whole digits and the cents of one superscript price. */
function insertDecimalPoint(
  text: string,
  { pattern, wholeLength, occurrence }: SuperscriptCents,
): string {
  const match = [...text.matchAll(pattern)][occurrence - 1];
  if (match === undefined) {
    return text;
  }
  const point = match.index + wholeLength;
  const centsStart = match.index + match[0].length - CENTS_LENGTH;
  return `${text.slice(0, point)}.${text.slice(centsStart)}`;
}
