// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartColorSettings } from "@/lib/trend-colors";
import {
  PopupChartColorsProvider,
  usePopupChartColors,
  useTrendPalette,
} from "@/entrypoints/popup/stores/chart-colors";

type StorageListener = (
  changes: Record<string, { readonly newValue?: unknown }>,
  areaName: string,
) => void;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Installs runtime messaging and a controllable storage change event. */
function stubBrowser(sendMessage: (message: unknown) => Promise<unknown>) {
  const listeners = new Set<StorageListener>();
  vi.stubGlobal("browser", {
    runtime: { sendMessage },
    storage: {
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
        removeListener: (listener: StorageListener) => listeners.delete(listener),
      },
    },
  });
  return {
    emit: (changes: Record<string, { readonly newValue?: unknown }>, areaName = "sync") => {
      act(() => {
        for (const listener of listeners) {
          listener(changes, areaName);
        }
      });
    },
    listeners,
  };
}

/** Renders the store with the palette it resolves for Japanese. */
function renderChartColors(preview?: ChartColorSettings) {
  return renderHook(
    () => ({
      palette: useTrendPalette("ja"),
      saveFailed: usePopupChartColors((state) => state.saveFailed),
      setColor: usePopupChartColors((state) => state.setColor),
      settings: usePopupChartColors((state) => state.settings),
    }),
    {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <PopupChartColorsProvider preview={preview}>{children}</PopupChartColorsProvider>
      ),
    },
  );
}

describe("popup chart color store", () => {
  it("applies preview choices without touching the browser", () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>();
    stubBrowser(sendMessage);
    const { result } = renderChartColors({ up: "#e3b63f" });

    expect(result.current.palette.up.line).toBe("#e3b63f");
    act(() => {
      result.current.setColor("up", null);
      result.current.setColor("down", "#8b5cf6");
    });
    expect(result.current.settings).toEqual({ down: "#8b5cf6" });
    expect(result.current.palette.up.line).toBe("var(--trend-red-line)");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("loads stored choices, saves new ones, and follows other popups", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      Promise.resolve(
        Reflect.get(Object(message), "type") === "GET_CHART_COLORS"
          ? { data: { down: "#8b5cf6" }, success: true }
          : { data: Reflect.get(Object(message), "payload"), success: true },
      ),
    );
    const storage = stubBrowser(sendMessage);
    const { result, unmount } = renderChartColors();

    await waitFor(() => expect(result.current.settings).toEqual({ down: "#8b5cf6" }));
    act(() => result.current.setColor("up", "#e3b63f"));
    expect(result.current.settings).toEqual({ down: "#8b5cf6", up: "#e3b63f" });
    await waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({
        payload: { down: "#8b5cf6", up: "#e3b63f" },
        type: "SET_CHART_COLORS",
      }),
    );

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    storage.emit({ chartColors: { newValue: { up: "#14a08a" } } });
    expect(result.current.settings).toEqual({ up: "#14a08a" });
    storage.emit({ chartColors: { newValue: { up: "#000000" } } }, "local");
    storage.emit({ config: { newValue: {} } });
    expect(result.current.settings).toEqual({ up: "#14a08a" });

    unmount();
    expect(storage.listeners.size).toBe(0);
  });

  it("ignores its own save echoes until the newest choice is stored", async () => {
    const save = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      Reflect.get(Object(message), "type") === "GET_CHART_COLORS"
        ? Promise.resolve({ data: {}, success: true })
        : save.promise,
    );
    const storage = stubBrowser(sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    act(() => result.current.setColor("up", "#e3b63f"));
    storage.emit({ chartColors: { newValue: { up: "#ef4444" } } });
    expect(result.current.settings).toEqual({ up: "#e3b63f" });
    save.resolve({ data: { up: "#e3b63f" }, success: true });
  });

  it.each([
    [
      "a failure response",
      () => Promise.resolve({ error: "Quota exceeded", success: false }),
    ],
    ["a runtime error", () => Promise.reject(new Error("Disconnected"))],
  ])("restores the stored choice after %s", async (_name, fail) => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      Reflect.get(Object(message), "type") === "GET_CHART_COLORS"
        ? Promise.resolve({ data: { up: "#14a08a" }, success: true })
        : fail(),
    );
    stubBrowser(sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(result.current.settings).toEqual({ up: "#14a08a" }));

    act(() => result.current.setColor("up", "#e3b63f"));
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(result.current.settings).toEqual({ up: "#14a08a" });
  });

  it("lets only the newest failed choice restore the stored value", async () => {
    const saves: PromiseWithResolvers<unknown>[] = [];
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (Reflect.get(Object(message), "type") === "GET_CHART_COLORS") {
        return Promise.resolve({ data: {}, success: true });
      }
      const save = Promise.withResolvers<unknown>();
      saves.push(save);
      return save.promise;
    });
    stubBrowser(sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setColor("up", "#e3b63f");
      result.current.setColor("up", "#14a08a");
    });
    await waitFor(() => expect(saves).toHaveLength(1));
    saves[0]?.reject(new Error("Disconnected"));
    await waitFor(() => expect(saves).toHaveLength(2));
    expect(result.current.settings).toEqual({ up: "#14a08a" });
    saves[1]?.resolve({ data: { up: "#14a08a" }, success: true });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(result.current.saveFailed).toBe(false);
  });

  it("keeps the defaults when loading fails or another popup changed colors first", async () => {
    const load = Promise.withResolvers<unknown>();
    const storage = stubBrowser(() => load.promise);
    const { result } = renderChartColors();

    storage.emit({ chartColors: { newValue: { down: "#71717a" } } });
    load.resolve({ data: { down: "#8b5cf6" }, success: true });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(result.current.settings).toEqual({ down: "#71717a" });

    cleanup();
    stubBrowser(() => Promise.reject(new Error("Disconnected")));
    const failed = renderChartColors();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(failed.result.current.settings).toEqual({});
  });

  it("works where storage events are unavailable", async () => {
    vi.stubGlobal("browser", {
      runtime: {
        sendMessage: () => Promise.resolve({ data: { up: "#e3b63f" }, success: true }),
      },
    });
    const { result, unmount } = renderChartColors();
    await waitFor(() => expect(result.current.settings).toEqual({ up: "#e3b63f" }));
    unmount();
  });

  it("requires the provider", () => {
    expect(() => renderHook(() => usePopupChartColors((state) => state.settings))).toThrow(
      "usePopupChartColors must be used within PopupChartColorsProvider.",
    );
  });
});
