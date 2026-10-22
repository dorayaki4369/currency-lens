// @vitest-environment happy-dom

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactRoot = vi.hoisted(() => {
  const render = vi.fn<(node: ReactNode) => void>();
  const createRoot = vi.fn<(container: Element) => { render: typeof render }>(() => ({
    render,
  }));
  return { createRoot, render };
});

vi.mock("react-dom/client", () => ({
  default: { createRoot: reactRoot.createRoot },
}));

vi.mock("@/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n")>()),
  getUiLocale: () => "ja",
}));

beforeEach(() => {
  vi.resetModules();
  reactRoot.createRoot.mockClear();
  reactRoot.render.mockClear();
  document.documentElement.lang = "";
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("popup entrypoint", () => {
  it("mounts the popup application and sets the document locale", async () => {
    const root = appendRoot();

    await import("@/entrypoints/popup/main");

    expect(document.documentElement.lang).toBe("ja");
    expect(reactRoot.createRoot).toHaveBeenCalledWith(root);
    expect(reactRoot.render).toHaveBeenCalledOnce();
  });

  it("fails clearly when the popup root is absent", async () => {
    await expect(import("@/entrypoints/popup/main")).rejects.toThrow(
      "Currency Lens popup root was not found",
    );
  });
});

/** Adds the root node expected by extension HTML entrypoints. */
function appendRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return root;
}
