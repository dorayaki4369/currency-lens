// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { navigatePopupRoute } from "@/entrypoints/popup/popup-route-transition";

const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "getAnimations",
);

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset["popupRouteTransitionDirection"];
  delete document.documentElement.dataset["popupRouteTransitionState"];
  Reflect.deleteProperty(document, "startViewTransition");
  if (getAnimationsDescriptor === undefined) {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  } else {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", getAnimationsDescriptor);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("popup route transition", () => {
  it("delegates to TanStack View Transition navigation when the API is available", async () => {
    stubMotionPreference(false);
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn(),
    });
    const navigate = vi.fn<() => Promise<void>>().mockResolvedValue();

    await navigatePopupRoute(navigate, "forward");

    expect(navigate).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset["popupRouteTransitionDirection"]).toBe(
      "forward",
    );
    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
  });

  it("navigates without a fallback snapshot when reduced motion is requested", async () => {
    stubMotionPreference(true);
    const navigate = vi.fn<() => Promise<void>>().mockResolvedValue();

    await navigatePopupRoute(navigate, "backward");

    expect(navigate).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
  });

  it("navigates directly when the popup frame is unavailable", async () => {
    stubMotionPreference(false);
    const navigate = vi.fn<() => Promise<void>>().mockResolvedValue();

    await navigatePopupRoute(navigate, "forward");
    document.body.append(createPopupRoot(false));
    await navigatePopupRoute(navigate, "backward");

    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it("ignores another fallback navigation while a transition is running", async () => {
    stubMotionPreference(false);
    stubAnimationFrame();
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: vi.fn(() => []),
    });
    const popupRoot = createPopupRoot(true);
    document.body.append(popupRoot);
    const navigation = Promise.withResolvers<void>();
    const firstNavigate = vi.fn(async () => {
      await navigation.promise;
      popupRoot
        .querySelector('[data-slot="popup-route"]')
        ?.replaceWith(createPopupRoute("New route"));
    });
    const secondNavigate = vi.fn<() => Promise<void>>().mockResolvedValue();

    const firstTransition = navigatePopupRoute(firstNavigate, "forward");
    const secondTransition = navigatePopupRoute(secondNavigate, "backward");

    expect(firstNavigate).toHaveBeenCalledOnce();
    expect(secondNavigate).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-popup-route-snapshot]")).toHaveLength(1);
    navigation.resolve();
    await Promise.all([firstTransition, secondTransition]);
    expect(document.documentElement.dataset["popupRouteTransitionDirection"]).toBe(
      "forward",
    );
    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
  });

  it("keeps an inert outgoing snapshot until fallback navigation finishes", async () => {
    stubMotionPreference(false);
    stubAnimationFrame();
    const finished = Promise.resolve();
    const animation = { finished } as unknown as Animation;
    const getAnimations = vi.fn(() => [animation]);
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: getAnimations,
    });
    const popupRoot = createPopupRoot(true);
    popupRoot.style.minHeight = "12px";
    document.body.append(popupRoot);
    const navigate = vi.fn(async () => {
      const snapshot = document.querySelector<HTMLElement>("[data-popup-route-snapshot]");
      expect(snapshot?.textContent).toContain("Old route");
      expect(snapshot?.getAttribute("aria-hidden")).toBe("true");
      expect(snapshot?.hasAttribute("inert")).toBe(true);
      expect(snapshot?.querySelector("[id], [for]")).toBeNull();
      popupRoot
        .querySelector('[data-slot="popup-route"]')
        ?.replaceWith(createPopupRoute("New route"));
    });

    await navigatePopupRoute(navigate, "forward");

    expect(popupRoot.textContent).toContain("New route");
    expect(popupRoot.style.minHeight).toBe("12px");
    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
    expect(document.documentElement.dataset["popupRouteTransitionState"]).toBeUndefined();
    expect(getAnimations).toHaveBeenCalledTimes(2);
  });

  it("cleans up the fallback when navigation does not mount another route", async () => {
    stubMotionPreference(false);
    const popupRoot = createPopupRoot(true);
    document.body.append(popupRoot);
    const navigate = vi.fn(async () => {
      popupRoot.querySelector('[data-slot="popup-route"]')?.remove();
    });

    await navigatePopupRoute(navigate, "backward");

    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
  });

  it("cleans up, releases the lock, and rethrows navigation errors", async () => {
    stubMotionPreference(false);
    const popupRoot = createPopupRoot(true);
    popupRoot.style.minHeight = "12px";
    document.body.append(popupRoot);
    const failure = new Error("navigation failed");

    await expect(navigatePopupRoute(() => Promise.reject(failure), "forward")).rejects.toBe(
      failure,
    );

    expect(popupRoot.style.minHeight).toBe("12px");
    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
    expect(document.documentElement.dataset["popupRouteTransitionState"]).toBeUndefined();

    stubAnimationFrame();
    const nextNavigate = vi.fn(async () => {
      popupRoot
        .querySelector('[data-slot="popup-route"]')
        ?.replaceWith(createPopupRoute("Recovered route"));
    });
    await navigatePopupRoute(nextNavigate, "backward");
    expect(nextNavigate).toHaveBeenCalledOnce();
  });

  it("falls back safely when animation inspection is unavailable", async () => {
    stubMotionPreference(false);
    stubAnimationFrame();
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: undefined,
    });
    const popupRoot = createPopupRoot(true);
    document.body.append(popupRoot);
    const navigate = vi.fn(async () => {
      popupRoot
        .querySelector('[data-slot="popup-route"]')
        ?.replaceWith(createPopupRoute("New route"));
    });

    await navigatePopupRoute(navigate, "forward");

    expect(popupRoot.textContent).toContain("New route");
    expect(document.querySelector("[data-popup-route-snapshot]")).toBeNull();
  });
});

/** Creates a popup frame with an optional active route. */
function createPopupRoot(withRoute: boolean): HTMLElement {
  const popupRoot = document.createElement("main");
  popupRoot.dataset["slot"] = "popup-root";
  if (withRoute) {
    popupRoot.append(createPopupRoute("Old route"));
  }
  return popupRoot;
}

/** Creates a route containing references that must not be duplicated in its snapshot. */
function createPopupRoute(label: string): HTMLElement {
  const route = document.createElement("section");
  route.dataset["slot"] = "popup-route";
  route.innerHTML = `<label for="route-control">${label}</label><button id="route-control">Open</button>`;
  return route;
}

/** Installs the motion preference used at the route-navigation boundary. */
function stubMotionPreference(reduced: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced })),
  );
}

/** Resolves fallback animation setup without depending on a rendered browser frame. */
function stubAnimationFrame(): void {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
}
