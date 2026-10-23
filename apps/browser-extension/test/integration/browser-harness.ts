import axe, { type ElementContext, type Result } from "axe-core";
import type { Root } from "react-dom/client";
import { afterEach, expect } from "vitest";
import { commands, page } from "vitest/browser";
import {
  mountComponentFixture,
  mountConversionScreen,
  mountPopupScreen,
  type ConversionScreenOptions,
  type PopupScreenOptions,
} from "@/test/integration/screens";
import { WCAG_AA_TAGS } from "@/test/accessibility-rules";
import type { MediaEmulation, PointerPosition } from "@/test/integration/browser-commands";
import type { ComponentFixtureId } from "@/test/integration/component-fixtures/fixtures";
import { COMPONENT_FIXTURES } from "@/test/integration/component-fixtures/fixtures";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateMedia: (media: MediaEmulation) => Promise<void>;
    pointerDown: () => Promise<void>;
    pointerHover: (
      target: { readonly selector: string },
      position?: PointerPosition,
    ) => Promise<void>;
    pointerUp: () => Promise<void>;
  }
}

export interface Viewport {
  readonly height: number;
  readonly width: number;
}

const DEFAULT_VIEWPORT: Viewport = { height: 720, width: 1_280 };
// Resolved from each spec file into the review directory shared with E2E.
const REVIEW_SCREENSHOT_DIRECTORY = "../__screenshots__/review";
const TEST_STYLE_ATTRIBUTE = "data-integration-style";
const initialRootClassName = document.documentElement.className;
const initialRootStyle = document.documentElement.getAttribute("style");
let mountedScreen: { readonly container: HTMLElement; readonly root: Root } | null = null;

afterEach(async () => {
  resetScreenDocument();
  await commands.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
});

/** Sets the test iframe viewport. */
export async function setViewport(viewport: Viewport = DEFAULT_VIEWPORT): Promise<void> {
  await page.viewport(viewport.width, viewport.height);
}

/** Emulates user media preferences such as reduced motion for the whole test page. */
export async function emulateMedia(media: MediaEmulation): Promise<void> {
  await commands.emulateMedia(media);
}

/** Mounts the popup screen and waits until its converter is ready. */
export async function openPopupScreen(
  options: Partial<PopupScreenOptions> = {},
): Promise<void> {
  mountScreen((container) =>
    mountPopupScreen(container, { theme: options.theme ?? "light" }),
  );
  await expect.element(page.getByRole("heading", { name: "Currency Lens" })).toBeVisible();
}

/** Mounts the conversion-card screen and returns the root that contains the card. */
export async function openConversionScreen(
  options: Partial<ConversionScreenOptions> = {},
): Promise<Document | ShadowRoot> {
  const container = mountScreen((element) =>
    mountConversionScreen(element, {
      motion: options.motion ?? "default",
      root: options.root ?? "document",
      state: options.state ?? "success",
    }),
  );
  const renderRoot = container.shadowRoot ?? document;
  await expect.poll(() => renderRoot.querySelector("dialog")).not.toBeNull();
  return renderRoot;
}

/** Mounts one deterministic component fixture at its documented viewport. */
export async function openComponentFixture(fixtureId: ComponentFixtureId): Promise<void> {
  const fixture = COMPONENT_FIXTURES.find((candidate) => candidate.id === fixtureId);
  if (fixture === undefined) {
    throw new Error(`Unknown component fixture: ${fixtureId}`);
  }
  await setViewport(fixture);
  mountScreen((container) => mountComponentFixture(container, fixture));
  await expect
    .poll(() => document.documentElement.dataset["componentFixtureReady"])
    .toBe("true");
}

/** Saves the painted page as an uncompared image for manual design review. */
export async function saveReviewScreenshot(name: string): Promise<void> {
  await nextFrames();
  await page.screenshot({ path: `${REVIEW_SCREENSHOT_DIRECTORY}/${name}.png` });
}

/** Adds host-page CSS that is removed after the current test. */
export function addHostStyle(css: string): void {
  const style = document.createElement("style");
  style.setAttribute(TEST_STYLE_ATTRIBUTE, "");
  style.textContent = css;
  document.head.append(style);
}

/** Returns a rendered element and fails with the selector when it is absent. */
export function requireElement(selector: string, root: ParentNode = document): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Element was not rendered: ${selector}`);
  }
  return element;
}

/** Returns every rendered element that matches a selector. */
export function queryAll<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

/** Waits for a selector to render and returns its first match. */
export async function waitForElement(
  selector: string,
  root: ParentNode = document,
): Promise<HTMLElement> {
  await expect.poll(() => root.querySelector(selector)).not.toBeNull();
  return requireElement(selector, root);
}

type RoleOptions = Parameters<typeof page.getByRole>[1];

/** Waits for an accessible role inside a container and returns the first match. */
export async function findByRole(
  role: Parameters<typeof page.getByRole>[0],
  options: RoleOptions = {},
  container: Node = document,
): Promise<HTMLElement> {
  const matches = () =>
    page
      .getByRole(role, options)
      .elements()
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && container.contains(element),
      );
  await expect.poll(() => matches().length).toBeGreaterThan(0);
  const [match] = matches();
  if (match === undefined) {
    throw new Error(`Role was not rendered: ${role}`);
  }
  return match;
}

/** Converts a design length in rem to the pixels the browser currently renders. */
export function rem(value: number): number {
  return value * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/** Compares rendered edges with one pixel of browser rounding tolerance. */
export function expectEdge(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

/** Waits for the browser to paint the current state. */
export async function nextFrames(count = 2): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    // Frames must elapse one after another.
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => resolveFrame());
    });
  }
}

/** Moves the real mouse over an element, optionally to a point relative to its top-left corner. */
export async function movePointer(
  target: Element,
  position?: PointerPosition,
): Promise<void> {
  await commands.pointerHover({ selector: page.elementLocator(target).selector }, position);
}

/** Presses the primary mouse button at the current pointer position. */
export async function pressPointer(): Promise<void> {
  await commands.pointerDown();
}

/** Releases the primary mouse button at the current pointer position. */
export async function releasePointer(): Promise<void> {
  await commands.pointerUp();
}

/** Runs axe against one rendered region with the repository's WCAG AA rule set. */
export async function findAccessibilityViolations(
  context: ElementContext,
): Promise<readonly Result[]> {
  const results = await axe.run(context, {
    runOnly: { type: "tag", values: [...WCAG_AA_TAGS] },
  });
  return results.violations;
}

/** Replaces any mounted screen with a fresh one in a new root container. */
function mountScreen(render: (container: HTMLElement) => Root): HTMLElement {
  resetScreenDocument();
  const container = document.createElement("div");
  container.id = "root";
  document.body.append(container);
  mountedScreen = { container, root: render(container) };
  return container;
}

/** Removes screen DOM and document-level state so each test starts from a clean page. */
function resetScreenDocument(): void {
  mountedScreen?.root.unmount();
  mountedScreen?.container.remove();
  mountedScreen = null;
  for (const style of document.querySelectorAll(`[${TEST_STYLE_ATTRIBUTE}]`)) {
    style.remove();
  }
  delete document.documentElement.dataset["componentFixtureReady"];
  delete document.documentElement.dataset["popupRouteTransitionState"];
  delete document.body.dataset["componentFixture"];
  document.documentElement.className = initialRootClassName;
  if (initialRootStyle === null) {
    document.documentElement.removeAttribute("style");
  } else {
    document.documentElement.setAttribute("style", initialRootStyle);
  }
  if (Object.hasOwn(document, "startViewTransition")) {
    Reflect.deleteProperty(document, "startViewTransition");
  }
  window.scrollTo(0, 0);
}
