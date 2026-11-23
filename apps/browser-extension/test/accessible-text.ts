/**
 * Reads an element's text as assistive technology does, leaving out aria-hidden subtrees such
 * as the glyph reels of a rolling number, whose plain value sits in a visually hidden label.
 */
export function readAccessibleText(element: Element | null): string | undefined {
  if (element === null) {
    return undefined;
  }
  const copy = element.cloneNode(true);
  if (!(copy instanceof Element)) {
    return undefined;
  }
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent ?? undefined;
}
