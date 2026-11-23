// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartColorSettings } from "@/lib/trend-colors";
import {
  ChartColorsProvider,
  useChartColors,
  useTrendPalette,
} from "@/stores/chart-colors";

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

/** Simulates the background's merge-on-write storage with controllable replies. */
function createFakeBackground(initial: ChartColorSettings) {
  let stored: ChartColorSettings = { ...initial };
  let reads = 0;
  let readFailure: unknown = null;
  let heldReads: (() => void)[] | null = null;
  let writeFailure: unknown = null;
  let failingWrites = Number.POSITIVE_INFINITY;
  let held: (() => void)[] | null = null;
  const reply = (value: unknown) =>
    new Promise<unknown>((resolve) => {
      if (held === null) {
        resolve(value);
      } else {
        held.push(() => resolve(value));
      }
    });
  const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
    if (Reflect.get(Object(message), "type") === "GET_CHART_COLORS") {
      reads += 1;
      if (readFailure instanceof Error) {
        return Promise.reject(readFailure);
      }
      const result = readFailure ?? { data: { ...stored }, success: true };
      return new Promise<unknown>((resolve) => {
        if (heldReads === null) {
          resolve(result);
        } else {
          heldReads.push(() => resolve({ data: { ...stored }, success: true }));
        }
      });
    }
    if (writeFailure !== null && failingWrites > 0) {
      failingWrites -= 1;
      return writeFailure instanceof Error
        ? Promise.reject(writeFailure)
        : Promise.resolve(writeFailure);
    }
    const payload: unknown = Reflect.get(Object(message), "payload");
    const direction = String(Reflect.get(Object(payload), "direction")) as "down" | "up";
    const color: unknown = Reflect.get(Object(payload), "color");
    const next = { ...stored };
    if (typeof color === "string") {
      next[direction] = color;
    } else {
      delete next[direction];
    }
    stored = next;
    return reply({ data: { ...next }, success: true });
  });
  return {
    failReads: (failure: unknown = new Error("Disconnected")) => {
      readFailure = failure;
    },
    holdReads: () => {
      heldReads = [];
    },
    releaseReads: () => {
      const pending = heldReads ?? [];
      heldReads = null;
      for (const resolve of pending) {
        resolve();
      }
    },
    failWrites: (failure: unknown, count = Number.POSITIVE_INFINITY) => {
      writeFailure = failure;
      failingWrites = count;
    },
    holdResponses: () => {
      held = [];
    },
    reads: () => reads,
    releaseResponses: () => {
      const pending = held ?? [];
      held = null;
      for (const resolve of pending) {
        resolve();
      }
    },
    sendMessage,
    stored: () => stored,
    write: (value: ChartColorSettings) => {
      stored = value;
    },
  };
}

/** Renders the store with the palette it resolves. */
function renderChartColors(preview?: ChartColorSettings) {
  return renderHook(
    () => ({
      palette: useTrendPalette(),
      saveFailed: useChartColors((state) => state.saveFailed),
      setColor: useChartColors((state) => state.setColor),
      settings: useChartColors((state) => state.settings),
    }),
    {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <ChartColorsProvider preview={preview}>{children}</ChartColorsProvider>
      ),
    },
  );
}

describe("chart color store", () => {
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
    expect(result.current.palette.up.line).toBe("var(--trend-green-line)");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("loads stored choices, saves one direction, and follows other popups", async () => {
    const background = createFakeBackground({ down: "#8b5cf6" });
    const storage = stubBrowser(background.sendMessage);
    const { result, unmount } = renderChartColors();

    await waitFor(() => expect(result.current.settings).toEqual({ down: "#8b5cf6" }));
    act(() => result.current.setColor("up", "#e3b63f"));
    expect(result.current.settings).toEqual({ down: "#8b5cf6", up: "#e3b63f" });
    await waitFor(() =>
      expect(background.sendMessage).toHaveBeenCalledWith({
        payload: { color: "#e3b63f", direction: "up" },
        type: "SET_CHART_COLORS",
      }),
    );
    await waitFor(() => expect(background.reads()).toBe(2));
    expect(result.current.settings).toEqual({ down: "#8b5cf6", up: "#e3b63f" });

    storage.emit({ chartColors: { newValue: { up: "#14a08a" } } });
    expect(result.current.settings).toEqual({ up: "#14a08a" });
    storage.emit({ chartColors: { newValue: { up: "#000000" } } }, "local");
    storage.emit({ config: { newValue: {} } });
    expect(result.current.settings).toEqual({ up: "#14a08a" });

    unmount();
    expect(storage.listeners.size).toBe(0);
  });

  it("shows another popup's change made while this popup was saving", async () => {
    const background = createFakeBackground({});
    const storage = stubBrowser(background.sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(background.reads()).toBe(1));
    background.holdResponses();

    // Popup A saves the rise color; its write lands first and its reply is delayed.
    act(() => result.current.setColor("up", "#e3b63f"));
    await waitFor(() => expect(background.stored()).toEqual({ up: "#e3b63f" }));
    // Popup B then changes the fall color, and the echo of A's own write is ignored.
    storage.emit({ chartColors: { newValue: { up: "#e3b63f" } } });
    background.write({ down: "#71717a", up: "#e3b63f" });
    storage.emit({ chartColors: { newValue: background.stored() } });
    expect(result.current.settings).toEqual({ up: "#e3b63f" });

    background.releaseResponses();
    await waitFor(() =>
      expect(result.current.settings).toEqual({ down: "#71717a", up: "#e3b63f" }),
    );

    // A's next choice changes only its own direction and keeps B's fall color.
    act(() => result.current.setColor("up", null));
    await waitFor(() => expect(result.current.settings).toEqual({ down: "#71717a" }));
    expect(background.stored()).toEqual({ down: "#71717a" });
  });

  it.each([
    ["a failure response", { error: "Quota exceeded", success: false }],
    ["a runtime error", new Error("Disconnected")],
  ])("restores the stored choice after %s", async (_name, failure) => {
    const background = createFakeBackground({ up: "#14a08a" });
    background.failWrites(failure);
    stubBrowser(background.sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(result.current.settings).toEqual({ up: "#14a08a" }));

    act(() => result.current.setColor("up", "#e3b63f"));
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    await waitFor(() => expect(result.current.settings).toEqual({ up: "#14a08a" }));
  });

  it.each([
    ["a failure response", { error: "Unavailable", success: false }],
    ["a runtime error", new Error("Disconnected")],
  ])(
    "falls back to the last seen value when rereading fails with %s",
    async (_name, failure) => {
      const background = createFakeBackground({ up: "#14a08a" });
      stubBrowser(background.sendMessage);
      const { result } = renderChartColors();
      await waitFor(() => expect(result.current.settings).toEqual({ up: "#14a08a" }));
      background.failReads(failure);

      act(() => result.current.setColor("down", "#e3b63f"));
      await waitFor(() =>
        expect(background.stored()).toEqual({ down: "#e3b63f", up: "#14a08a" }),
      );
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(result.current.settings).toEqual({ down: "#e3b63f", up: "#14a08a" });
    },
  );

  it("leaves a newer pending choice on screen while an earlier reread finishes", async () => {
    const background = createFakeBackground({});
    stubBrowser(background.sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(background.reads()).toBe(1));
    background.holdReads();

    act(() => result.current.setColor("up", "#e3b63f"));
    await waitFor(() => expect(background.reads()).toBe(2));
    background.holdResponses();
    act(() => result.current.setColor("down", "#71717a"));
    background.releaseReads();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(result.current.settings).toEqual({ down: "#71717a", up: "#e3b63f" });

    background.releaseResponses();
    await waitFor(() => expect(background.reads()).toBe(3));
    background.releaseReads();
    await waitFor(() =>
      expect(result.current.settings).toEqual({ down: "#71717a", up: "#e3b63f" }),
    );
  });

  it("reports a failure only when the newest choice failed", async () => {
    const background = createFakeBackground({});
    stubBrowser(background.sendMessage);
    const { result } = renderChartColors();
    await waitFor(() => expect(background.reads()).toBe(1));
    background.failWrites(new Error("Disconnected"), 1);

    act(() => {
      result.current.setColor("up", "#e3b63f");
      result.current.setColor("up", "#14a08a");
    });
    await waitFor(() => expect(background.stored()).toEqual({ up: "#14a08a" }));
    await waitFor(() => expect(background.reads()).toBe(2));
    expect(result.current.saveFailed).toBe(false);
    expect(result.current.settings).toEqual({ up: "#14a08a" });
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
    expect(() => renderHook(() => useChartColors((state) => state.settings))).toThrow(
      "useChartColors must be used within ChartColorsProvider.",
    );
  });
});
