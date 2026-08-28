// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSelection } from "../entrypoints/content/hooks/useSelection";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("useSelection", () => {
  it.each([
    ["the Selection API is unavailable", () => null],
    ["there is no range", () => selectionWith({ rangeCount: 0 })],
    ["the selection is collapsed", () => selectionWith({ isCollapsed: true })],
  ])("clears the result when %s", (_description, getSelection) => {
    const selectionSpy = vi.spyOn(window, "getSelection").mockReturnValue(selectionWith());
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();
    expect(result.current?.text).toBe("$10");

    selectionSpy.mockImplementation(getSelection);
    dispatchSelectionChange();

    expect(result.current).toBeNull();
  });

  it.each([
    ["empty", "   ", new DOMRect(0, 0, 20, 10)],
    ["too long", "$".repeat(1_001), new DOMRect(0, 0, 20, 10)],
    ["not visible", "$10", new DOMRect(0, 0, 0, 0)],
  ])("ignores a %s selection", (_description, text, rect) => {
    const selectionSpy = vi.spyOn(window, "getSelection").mockReturnValue(selectionWith());
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();
    expect(result.current?.text).toBe("$10");

    selectionSpy.mockReturnValue(selectionWith({ rect, text }));
    dispatchSelectionChange();

    expect(result.current).toBeNull();
  });

  it("returns a trimmed, visible selection and replaces a pending debounce", () => {
    const rect = new DOMRect(10, 20, 30, 40);
    vi.spyOn(window, "getSelection").mockReturnValue(
      selectionWith({ rect, text: "  USD 10  " }),
    );
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const { result } = renderHook(() => useSelection(25));

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
      document.dispatchEvent(new Event("selectionchange"));
      vi.runOnlyPendingTimers();
    });

    expect(clearTimeout).toHaveBeenCalledOnce();
    expect(result.current).toEqual({ rect, text: "USD 10" });
  });

  it("removes the listener and cancels a pending read on unmount", () => {
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const getSelection = vi.spyOn(window, "getSelection");
    const { unmount } = renderHook(() => useSelection(25));

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    unmount();

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
      vi.runOnlyPendingTimers();
    });

    expect(clearTimeout).toHaveBeenCalledOnce();
    expect(getSelection).not.toHaveBeenCalled();
  });

  it("removes the listener when no read is pending", () => {
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const { unmount } = renderHook(() => useSelection());

    unmount();

    expect(clearTimeout).not.toHaveBeenCalled();
  });

  it.each([
    ["an input", () => createControl("input")],
    ["a textarea text node", () => createControlTextNode("textarea")],
    ["a select", () => createControl("select")],
    ["an empty contenteditable attribute", createEmptyContentEditable],
    ["an explicit contenteditable region", createExplicitContentEditable],
    ["a plaintext-only editor", createPlaintextOnlyEditor],
    ["an inherited editable region", createInheritedEditableRegion],
  ])("ignores selections inside %s", (_description, createEditableRegion) => {
    const selectedNode = createEditableRegion();
    const selectionSpy = vi.spyOn(window, "getSelection").mockReturnValue(selectionWith());
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();
    expect(result.current?.text).toBe("$10");

    selectionSpy.mockReturnValue(selectionWith({ commonAncestorContainer: selectedNode }));
    dispatchSelectionChange();

    expect(result.current).toBeNull();
  });

  it("treats contenteditable=false as a non-editable boundary", () => {
    const element = document.createElement("div");
    element.setAttribute("contenteditable", "false");
    document.body.append(element);
    vi.spyOn(window, "getSelection").mockReturnValue(
      selectionWith({ commonAncestorContainer: element }),
    );
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();

    expect(result.current?.text).toBe("$10");
  });

  it("walks past an unrecognized contenteditable value", () => {
    const element = document.createElement("div");
    element.setAttribute("contenteditable", "inherit");
    document.body.append(element);
    vi.spyOn(window, "getSelection").mockReturnValue(
      selectionWith({ commonAncestorContainer: element }),
    );
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();

    expect(result.current?.text).toBe("$10");
  });

  it("accepts a detached text node without an element parent", () => {
    vi.spyOn(window, "getSelection").mockReturnValue(
      selectionWith({ commonAncestorContainer: document.createTextNode("$10") }),
    );
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();

    expect(result.current?.text).toBe("$10");
  });

  it("walks through non-HTML elements when checking editable ancestors", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.append(svg);
    vi.spyOn(window, "getSelection").mockReturnValue(
      selectionWith({ commonAncestorContainer: svg }),
    );
    const { result } = renderHook(() => useSelection(0));

    dispatchSelectionChange();

    expect(result.current?.text).toBe("$10");
  });
});

function dispatchSelectionChange(): void {
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
    vi.runOnlyPendingTimers();
  });
}

function selectionWith({
  commonAncestorContainer = document.body,
  isCollapsed = false,
  rangeCount = 1,
  rect = new DOMRect(0, 0, 20, 10),
  text = "$10",
}: {
  readonly commonAncestorContainer?: Node;
  readonly isCollapsed?: boolean;
  readonly rangeCount?: number;
  readonly rect?: DOMRect;
  readonly text?: string;
} = {}): Selection {
  return {
    getRangeAt: () =>
      ({
        commonAncestorContainer,
        getBoundingClientRect: () => rect,
      }) as Range,
    isCollapsed,
    rangeCount,
    toString: () => text,
  } as unknown as Selection;
}

function createControl(tagName: "input" | "select"): HTMLElement {
  const element = document.createElement(tagName);
  document.body.append(element);
  return element;
}

function createControlTextNode(tagName: "textarea"): Node {
  const element = document.createElement(tagName);
  const text = document.createTextNode("$10");
  element.append(text);
  document.body.append(element);
  return text;
}

function createEmptyContentEditable(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "");
  document.body.append(editor);
  return editor;
}

function createExplicitContentEditable(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  document.body.append(editor);
  Object.defineProperty(editor, "isContentEditable", { value: true });
  return editor;
}

function createPlaintextOnlyEditor(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "plaintext-only");
  document.body.append(editor);
  return editor;
}

function createInheritedEditableRegion(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  const child = document.createElement("span");
  editor.append(child);
  document.body.append(editor);
  return child;
}
