// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSelection } from "../entrypoints/content/hooks/useSelection";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("useSelection", () => {
  it.each([
    ["an empty contenteditable attribute", createEmptyContentEditable],
    ["a plaintext-only editor", createPlaintextOnlyEditor],
    ["an inherited editable region", createInheritedEditableRegion],
  ])("ignores selections inside %s", (_description, createEditableRegion) => {
    const selectedElement = createEditableRegion();
    const selection = window.getSelection();
    if (!selection) {
      throw new Error("Selection API is unavailable in the test DOM");
    }
    const range = document.createRange();
    range.selectNodeContents(selectedElement);
    vi.spyOn(range, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 20, 10));
    selection.removeAllRanges();
    selection.addRange(range);
    const getSelection = vi.spyOn(window, "getSelection");
    const { result } = renderHook(() => useSelection(0));

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
      vi.runOnlyPendingTimers();
    });

    expect(getSelection).toHaveBeenCalledOnce();
    expect(result.current).toBeNull();
  });
});

function createEmptyContentEditable(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "");
  editor.textContent = "$10";
  document.body.append(editor);
  return editor;
}

function createPlaintextOnlyEditor(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "plaintext-only");
  editor.textContent = "$10";
  document.body.append(editor);
  return editor;
}

function createInheritedEditableRegion(): HTMLElement {
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  const child = document.createElement("span");
  child.textContent = "$10";
  editor.append(child);
  document.body.append(editor);
  return child;
}
