// @vitest-environment happy-dom

import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactRoot = vi.hoisted(() => {
  const render = vi.fn<(node: ReactNode) => void>();
  const createRoot = vi.fn<(container: Element) => { render: typeof render }>(() => ({
    render,
  }));
  return { createRoot, render };
});

vi.mock("react-dom/client", () => ({
  createRoot: reactRoot.createRoot,
  default: { createRoot: reactRoot.createRoot },
}));

vi.mock("node:url", () => ({
  default: { fileURLToPath: mockFileUrlToPath },
  fileURLToPath: mockFileUrlToPath,
}));

beforeEach(() => {
  vi.resetModules();
  reactRoot.createRoot.mockClear();
  reactRoot.render.mockClear();
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
});

describe("design preview entrypoints", () => {
  it.each(["conversion", "options", "popup"] as const)(
    "mounts the %s preview",
    async (previewName) => {
      const root = appendRoot();

      await importPreview(previewName);

      expect(reactRoot.createRoot).toHaveBeenCalledWith(root);
      expect(reactRoot.render).toHaveBeenCalledOnce();
    },
  );

  it("provides inert callbacks to the conversion preview", async () => {
    appendRoot();
    await importPreview("conversion");

    const callbacks = findPreviewCallbacks(reactRoot.render.mock.calls[0]?.[0]);
    expect(callbacks).not.toBeNull();
    callbacks?.onClose();
    callbacks?.setFloating(null);
  });

  it.each([
    [
      "success",
      {
        data: expect.any(Object),
        detection: expect.any(Object),
        error: null,
        loading: false,
      },
    ],
    ["loading", { data: null, detection: expect.any(Object), error: null, loading: true }],
    ["empty", { data: null, detection: null, error: null, loading: false }],
    [
      "error",
      {
        data: null,
        detection: expect.any(Object),
        error: "RATES_UNAVAILABLE",
        loading: false,
      },
    ],
  ] as const)("renders the conversion %s state", async (state, expectedProps) => {
    window.history.replaceState(null, "", `/?state=${state}`);
    appendRoot();

    await importPreview("conversion");

    expect(findConversionPreviewProps(reactRoot.render.mock.calls[0]?.[0])).toEqual(
      expectedProps,
    );
  });

  it("falls back to the success conversion state for an unknown query value", async () => {
    window.history.replaceState(null, "", "/?state=unsupported");
    appendRoot();

    await importPreview("conversion");

    expect(findConversionPreviewProps(reactRoot.render.mock.calls[0]?.[0])).toEqual({
      data: expect.any(Object),
      detection: expect.any(Object),
      error: null,
      loading: false,
    });
  });

  it("enables the reduced-motion conversion preview", async () => {
    window.history.replaceState(null, "", "/?state=loading&motion=reduce");
    appendRoot();

    await importPreview("conversion");

    expect(findPreviewClassName(reactRoot.render.mock.calls[0]?.[0])).toContain(
      "cl-preview-reduced-motion",
    );
  });

  it.each(["conversion", "options", "popup"] as const)(
    "fails clearly when the %s preview root is absent",
    async (previewName) => {
      await expect(importPreview(previewName)).rejects.toThrow(
        "Preview root was not found",
      );
    },
  );

  it("keeps preview builds isolated from environment files", async () => {
    const { default: config } = await import("../design-preview/vite.config");

    expect(config).toMatchObject({
      base: "./",
      build: {
        emptyOutDir: true,
        outDir: ".output",
        rollupOptions: {
          input: {
            conversion: expect.stringContaining("conversion.html"),
            options: expect.stringContaining("options.html"),
            popup: expect.stringContaining("popup.html"),
          },
        },
      },
      envDir: false,
    });
  });
});

interface PreviewCallbacks {
  readonly onClose: () => void;
  readonly setFloating: (node: HTMLElement | null) => void;
}

interface PreviewElementProps {
  readonly children?: ReactNode;
  readonly className?: unknown;
  readonly data?: unknown;
  readonly detection?: unknown;
  readonly error?: unknown;
  readonly loading?: unknown;
  readonly onClose?: unknown;
  readonly setFloating?: unknown;
}

/** Finds the preview wrapper class list rendered around the conversion card. */
function findPreviewClassName(node: ReactNode): string | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<PreviewElementProps>(child)) {
      continue;
    }
    if (
      typeof child.props.className === "string" &&
      child.props.className.includes("cl-preview-lens")
    ) {
      return child.props.className;
    }
    const nestedClassName = findPreviewClassName(child.props.children);
    if (nestedClassName !== null) {
      return nestedClassName;
    }
  }
  return null;
}

interface ConversionPreviewProps {
  readonly data: unknown;
  readonly detection: unknown;
  readonly error: unknown;
  readonly loading: boolean;
}

/** Finds the callback props created inside the conversion preview JSX. */
function findPreviewCallbacks(node: ReactNode): PreviewCallbacks | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<PreviewElementProps>(child)) {
      continue;
    }
    const { onClose, setFloating } = child.props;
    if (isVoidCallback(onClose) && isFloatingCallback(setFloating)) {
      return { onClose, setFloating };
    }
    const nestedCallbacks = findPreviewCallbacks(child.props.children);
    if (nestedCallbacks !== null) {
      return nestedCallbacks;
    }
  }
  return null;
}

/** Finds the state props passed to the conversion card preview. */
function findConversionPreviewProps(node: ReactNode): ConversionPreviewProps | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<PreviewElementProps>(child)) {
      continue;
    }
    const { data, detection, error, loading } = child.props;
    if (
      Object.hasOwn(child.props, "data") &&
      Object.hasOwn(child.props, "detection") &&
      Object.hasOwn(child.props, "error") &&
      typeof loading === "boolean"
    ) {
      return { data, detection, error, loading };
    }
    const nestedProps = findConversionPreviewProps(child.props.children);
    if (nestedProps !== null) {
      return nestedProps;
    }
  }
  return null;
}

/** Narrows an unknown React prop to the close callback contract. */
function isVoidCallback(value: unknown): value is () => void {
  return typeof value === "function";
}

/** Narrows an unknown React prop to the floating-reference callback contract. */
function isFloatingCallback(value: unknown): value is (node: HTMLElement | null) => void {
  return typeof value === "function";
}

/** Makes a deterministic file root available while Vite transforms import.meta.url. */
function mockFileUrlToPath(): string {
  return "/currency-lens/design-preview/";
}

/** Imports one side-effect preview entrypoint through statically analyzable paths. */
async function importPreview(
  previewName: "conversion" | "options" | "popup",
): Promise<void> {
  if (previewName === "conversion") {
    await import("../design-preview/conversion");
  } else if (previewName === "options") {
    await import("../design-preview/options");
  } else {
    await import("../design-preview/popup");
  }
}

/** Adds the root node expected by preview HTML entrypoints. */
function appendRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return root;
}
