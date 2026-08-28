// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

interface RootLike {
  readonly render: (node: unknown) => void;
  readonly unmount: () => void;
}

interface ShadowOptions {
  readonly isolateEvents: readonly string[];
  readonly name: string;
  readonly onMount: (container: HTMLElement) => RootLike;
  readonly onRemove: (mountedRoot?: RootLike) => void;
  readonly position: string;
  readonly zIndex: number;
}

interface ContentDefinition {
  readonly cssInjectionMode: string;
  readonly main: (context: unknown) => Promise<void>;
  readonly matches: readonly string[];
}

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn<(container: HTMLElement) => RootLike>(),
  createShadowRootUi:
    vi.fn<
      (context: unknown, options: ShadowOptions) => Promise<{ readonly mount: () => void }>
    >(),
  mount: vi.fn<() => void>(),
  render: vi.fn<(node: unknown) => void>(),
  unmount: vi.fn<() => void>(),
}));

vi.mock("react-dom/client", () => ({
  createRoot: mocks.createRoot,
}));

vi.mock("wxt/utils/content-script-ui/shadow-root", () => ({
  createShadowRootUi: mocks.createShadowRootUi,
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("content script entrypoint", () => {
  it("mounts and removes the React app inside an isolated overlay", async () => {
    const definitions: ContentDefinition[] = [];
    vi.stubGlobal("defineContentScript", (value: ContentDefinition) => {
      definitions.push(value);
      return value;
    });
    const root = { render: mocks.render, unmount: mocks.unmount };
    mocks.createRoot.mockReturnValue(root);
    const shadowOptions: ShadowOptions[] = [];
    mocks.createShadowRootUi.mockImplementation(
      (_context: unknown, value: ShadowOptions) => {
        shadowOptions.push(value);
        return Promise.resolve({ mount: mocks.mount });
      },
    );

    await import("../entrypoints/content/index");
    const definition = definitions[0];
    if (definition === undefined) {
      throw new Error("Content script definition was not registered");
    }
    const context = { id: "content-context" };
    await definition.main(context);

    expect(definition.cssInjectionMode).toBe("ui");
    expect(definition.matches).toEqual(["<all_urls>"]);
    expect(mocks.createShadowRootUi).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        isolateEvents: ["keydown", "keyup", "keypress", "pointerdown", "click"],
        name: "currency-lens-overlay",
        position: "overlay",
        zIndex: 2_147_483_647,
      }),
    );
    expect(mocks.mount).toHaveBeenCalledOnce();

    const options = shadowOptions[0];
    if (options === undefined) {
      throw new Error("Shadow-root UI options were not provided");
    }
    const container = document.createElement("div");
    expect(options.onMount(container)).toBe(root);
    expect(mocks.createRoot).toHaveBeenCalledWith(container);
    expect(mocks.render).toHaveBeenCalledOnce();

    options.onRemove(root);
    options.onRemove(undefined);
    expect(mocks.unmount).toHaveBeenCalledOnce();
  });
});
