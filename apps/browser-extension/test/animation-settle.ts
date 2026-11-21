/**
 * Waits for entrance and value transitions so review images never catch a frame mid-roll.
 *
 * `document.getAnimations()` leaves out animations inside shadow roots, where the content
 * script renders, so every open shadow root is searched as well. Endless animations such as
 * loading pulses and paused ones never finish, so they are skipped. The function is
 * self-contained because Playwright serializes it into the page.
 */
export async function settleFiniteAnimations(): Promise<void> {
  const roots: (Document | ShadowRoot)[] = [document];
  for (let index = 0; index < roots.length; index += 1) {
    for (const element of roots[index]!.querySelectorAll("*")) {
      if (element.shadowRoot !== null) {
        roots.push(element.shadowRoot);
      }
    }
  }
  await Promise.all(
    roots
      .flatMap((root) => root.getAnimations())
      .filter(
        (animation) =>
          animation.playState !== "paused" &&
          animation.effect?.getTiming().iterations !== Infinity,
      )
      .map((animation) => animation.finished.catch(() => undefined)),
  );
}
