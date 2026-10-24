export type PopupRouteTransitionDirection = "backward" | "forward";

type PopupRouteNavigation = () => Promise<void>;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
let activeFallbackTransition: Promise<void> | null = null;
const SNAPSHOT_REFERENCE_ATTRIBUTES = [
  "aria-activedescendant",
  "aria-controls",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
  "aria-labelledby",
  "aria-owns",
  "for",
  "id",
] as const;

/** Navigates with TanStack View Transition support or a dual-screen CSS fallback. */
export async function navigatePopupRoute(
  navigate: PopupRouteNavigation,
  direction: PopupRouteTransitionDirection,
): Promise<void> {
  const documentRoot = document.documentElement;

  if (
    typeof document.startViewTransition === "function" ||
    matchMedia(REDUCED_MOTION_QUERY).matches
  ) {
    documentRoot.dataset["popupRouteTransitionDirection"] = direction;
    await navigate();
    return;
  }
  if (activeFallbackTransition !== null) {
    await activeFallbackTransition;
    return;
  }

  documentRoot.dataset["popupRouteTransitionDirection"] = direction;

  const popupRoot = document.querySelector<HTMLElement>('[data-slot="popup-root"]');
  if (popupRoot === null) {
    await navigate();
    return;
  }
  const outgoingRoute = popupRoot.querySelector<HTMLElement>(
    ':scope > [data-slot="popup-route"]',
  );
  if (outgoingRoute === null) {
    await navigate();
    return;
  }

  const transition = navigateWithPopupRouteSnapshot(
    navigate,
    direction,
    documentRoot,
    popupRoot,
    outgoingRoute,
  );
  activeFallbackTransition = transition;
  try {
    await transition;
  } finally {
    activeFallbackTransition = null;
  }
}

/** Keeps the old route visible while the unsupported browser mounts and slides the new route. */
async function navigateWithPopupRouteSnapshot(
  navigate: PopupRouteNavigation,
  direction: PopupRouteTransitionDirection,
  documentRoot: HTMLElement,
  popupRoot: HTMLElement,
  outgoingRoute: HTMLElement,
): Promise<void> {
  const snapshot = createPopupRouteSnapshot(outgoingRoute);
  const previousMinimumHeight = popupRoot.style.minHeight;
  // DOMRect measurements are CSS pixels; preserve that unit while freezing the layout.
  popupRoot.style.minHeight = `${String(popupRoot.getBoundingClientRect().height)}px`;
  document.body.append(snapshot);

  try {
    await navigate();
    const incomingRoute = popupRoot.querySelector<HTMLElement>(
      ':scope > [data-slot="popup-route"]',
    );
    if (incomingRoute === null) {
      return;
    }
    documentRoot.dataset["popupRouteTransitionDirection"] = direction;
    documentRoot.dataset["popupRouteTransitionState"] = "running";
    await waitForPopupRouteAnimations(snapshot, incomingRoute);
  } finally {
    delete documentRoot.dataset["popupRouteTransitionState"];
    popupRoot.style.minHeight = previousMinimumHeight;
    snapshot.remove();
  }
}

/** Clones the visible route into an inert overlay without duplicate reference identifiers. */
function createPopupRouteSnapshot(outgoingRoute: HTMLElement): HTMLElement {
  const bounds = outgoingRoute.getBoundingClientRect();
  const snapshot = document.importNode(outgoingRoute, true);
  snapshot.removeAttribute("data-slot");
  snapshot.dataset["popupRouteSnapshot"] = "";
  snapshot.setAttribute("aria-hidden", "true");
  snapshot.setAttribute("inert", "");
  // Keep the measured viewport coordinates unchanged so the snapshot cannot shift.
  snapshot.style.height = `${String(bounds.height)}px`;
  snapshot.style.left = `${String(bounds.left)}px`;
  snapshot.style.position = "fixed";
  snapshot.style.top = `${String(bounds.top)}px`;
  snapshot.style.width = `${String(bounds.width)}px`;

  for (const element of [snapshot, ...snapshot.querySelectorAll<HTMLElement>("*")]) {
    for (const attribute of SNAPSHOT_REFERENCE_ATTRIBUTES) {
      element.removeAttribute(attribute);
    }
  }
  return snapshot;
}

/** Waits until both fallback screen animations finish before removing the old snapshot. */
async function waitForPopupRouteAnimations(
  snapshot: HTMLElement,
  incomingRoute: HTMLElement,
): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const animations = [
    ...readElementAnimations(snapshot),
    ...readElementAnimations(incomingRoute),
  ];
  await Promise.allSettled(animations.map((animation) => animation.finished));
}

/** Reads animations when the runtime implements the Web Animations inspection API. */
function readElementAnimations(element: HTMLElement): Animation[] {
  return typeof element.getAnimations === "function" ? element.getAnimations() : [];
}
