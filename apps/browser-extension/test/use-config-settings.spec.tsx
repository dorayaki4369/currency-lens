// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConfigSettings } from "../entrypoints/shared/useConfigSettings";
import type { Config } from "../lib/currency";

const CONFIG: Config = {
  favorites: ["JPY", "EUR", "GBP"],
  showCurrencyCode: true,
  showCurrencyIcon: true,
  symbolOverrides: {},
  theme: "light",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useConfigSettings", () => {
  it("updates preview configuration without calling the browser boundary", () => {
    const sendMessage = vi.fn<() => void>();
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConfigSettings({ previewConfig: CONFIG }));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
    });

    expect(result.current).toMatchObject({
      config: { ...CONFIG, theme: "dark" },
      error: null,
      loading: false,
      saveState: "saved",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("loads and persists validated configuration", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      return Promise.resolve({ data: { ...CONFIG, theme: "dark" }, success: true });
    });
    stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
    });
    expect(result.current.saveState).toBe("saving");

    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(result.current.config?.theme).toBe("dark");
    expect(sendMessage).toHaveBeenCalledWith({
      payload: { ...CONFIG, theme: "dark" },
      type: "SET_CONFIG",
    });
  });

  it("reports a rejected configuration load and ignores updates without config", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(() =>
      Promise.resolve({ error: "Configuration unavailable", success: false }),
    );
    stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.updateConfig((current) => current);
    });

    expect(result.current.config).toBeNull();
    expect(result.current.error).toBe("Configuration unavailable");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new Error("Browser disconnected"), "Browser disconnected"],
    ["offline", "Settings could not be saved."],
  ])("normalizes a thrown load failure", async (failure, expectedMessage) => {
    stubBrowserBoundary(vi.fn<() => Promise<unknown>>(() => Promise.reject(failure)));
    const { result } = renderHook(() => useConfigSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(expectedMessage);
  });

  it("ignores a successful load from a cleaned-up strict-mode effect", async () => {
    const staleLoad = Promise.withResolvers<unknown>();
    const currentLoad = Promise.withResolvers<unknown>();
    stubBrowserBoundary(
      vi
        .fn<() => Promise<unknown>>()
        .mockImplementationOnce(() => staleLoad.promise)
        .mockImplementationOnce(() => currentLoad.promise),
    );
    const { result } = renderHook(() => useConfigSettings(), { wrapper: StrictMode });

    await act(async () => {
      currentLoad.resolve({ data: CONFIG, success: true });
      await currentLoad.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      staleLoad.resolve({ data: { ...CONFIG, theme: "dark" }, success: true });
      await staleLoad.promise;
    });

    expect(result.current.config?.theme).toBe("light");
    expect(result.current.error).toBeNull();
  });

  it("ignores a rejected load from a cleaned-up strict-mode effect", async () => {
    const staleLoad = Promise.withResolvers<unknown>();
    const currentLoad = Promise.withResolvers<unknown>();
    stubBrowserBoundary(
      vi
        .fn<() => Promise<unknown>>()
        .mockImplementationOnce(() => staleLoad.promise)
        .mockImplementationOnce(() => currentLoad.promise),
    );
    const { result } = renderHook(() => useConfigSettings(), { wrapper: StrictMode });

    await act(async () => {
      currentLoad.resolve({ data: CONFIG, success: true });
      await currentLoad.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      staleLoad.reject(new Error("Browser disconnected"));
      await staleLoad.promise.catch(() => undefined);
    });

    expect(result.current.config).toEqual(CONFIG);
    expect(result.current.error).toBeNull();
  });

  it("keeps only the latest successful queued save", async () => {
    const firstSave = Promise.withResolvers<unknown>();
    const secondSave = Promise.withResolvers<unknown>();
    let saveIndex = 0;
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      saveIndex += 1;
      return saveIndex === 1 ? firstSave.promise : secondSave.promise;
    });
    stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
      result.current.updateConfig((current) => ({ ...current, showCurrencyCode: false }));
    });
    await act(async () => {
      firstSave.resolve({ data: { ...CONFIG, theme: "dark" }, success: true });
      await firstSave.promise;
    });
    expect(result.current.saveState).toBe("saving");

    await waitFor(() => expect(saveIndex).toBe(2));
    await act(async () => {
      secondSave.resolve({
        data: { ...CONFIG, showCurrencyCode: false, theme: "dark" },
        success: true,
      });
      await secondSave.promise;
    });

    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(result.current.config).toMatchObject({
      showCurrencyCode: false,
      theme: "dark",
    });
  });

  it("does not roll back a newer revision when an earlier queued save fails", async () => {
    const firstSave = Promise.withResolvers<unknown>();
    const secondSave = Promise.withResolvers<unknown>();
    let saveIndex = 0;
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      saveIndex += 1;
      return saveIndex === 1 ? firstSave.promise : secondSave.promise;
    });
    stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
      result.current.updateConfig((current) => ({ ...current, showCurrencyIcon: false }));
    });
    await act(async () => {
      firstSave.reject(new Error("Older save failed"));
      await firstSave.promise.catch(() => undefined);
    });

    await waitFor(() => expect(saveIndex).toBe(2));
    expect(result.current.config).toMatchObject({
      showCurrencyIcon: false,
      theme: "dark",
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      secondSave.resolve({
        data: { ...CONFIG, showCurrencyIcon: false, theme: "dark" },
        success: true,
      });
      await secondSave.promise;
    });
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
  });

  it("rolls back the latest rejected save and normalizes non-Error failures", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      return Promise.reject("offline");
    });
    stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
    });
    await waitFor(() => expect(result.current.saveState).toBe("error"));

    expect(result.current.config).toEqual(CONFIG);
    expect(result.current.error).toBe("Settings could not be saved.");
  });

  it("uses a validated synchronized change as the base of the next save", async () => {
    const synchronizedConfig: Config = {
      ...CONFIG,
      favorites: ["CAD", "CHF"],
      showCurrencyIcon: false,
    };
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      return Promise.resolve({
        data: { ...synchronizedConfig, theme: "dark" },
        success: true,
      });
    });
    const storage = stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      storage.emitConfigChange(synchronizedConfig);
    });
    expect(result.current.config).toEqual(synchronizedConfig);

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
    });
    await waitFor(() => expect(result.current.saveState).toBe("saved"));

    expect(sendMessage).toHaveBeenLastCalledWith({
      payload: { ...synchronizedConfig, theme: "dark" },
      type: "SET_CONFIG",
    });
  });

  it("keeps a synchronized change that arrives before the initial load completes", async () => {
    const staleLoad = Promise.withResolvers<unknown>();
    const synchronizedConfig: Config = { ...CONFIG, theme: "dark" };
    const storage = stubBrowserBoundary(
      vi.fn<() => Promise<unknown>>(() => staleLoad.promise),
    );
    const { result } = renderHook(() => useConfigSettings());

    act(() => {
      storage.emitConfigChange(synchronizedConfig);
    });
    expect(result.current.config).toEqual(synchronizedConfig);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      staleLoad.resolve({ data: CONFIG, success: true });
      await staleLoad.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(synchronizedConfig);
  });

  it("does not let an earlier local storage event replace a newer optimistic update", async () => {
    const firstSave = Promise.withResolvers<unknown>();
    const secondSave = Promise.withResolvers<unknown>();
    const thirdSave = Promise.withResolvers<unknown>();
    const firstConfig: Config = { ...CONFIG, theme: "dark" };
    const secondConfig: Config = { ...firstConfig, showCurrencyCode: false };
    const thirdConfig: Config = { ...secondConfig, showCurrencyIcon: false };
    let saveIndex = 0;
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      saveIndex += 1;
      if (saveIndex === 1) {
        return firstSave.promise;
      }
      return saveIndex === 2 ? secondSave.promise : thirdSave.promise;
    });
    const storage = stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig(() => firstConfig);
      result.current.updateConfig(() => secondConfig);
    });
    act(() => {
      storage.emitConfigChange(firstConfig);
    });

    expect(result.current.config).toEqual(secondConfig);
    act(() => {
      result.current.updateConfig((current) => ({ ...current, showCurrencyIcon: false }));
    });
    expect(result.current.config).toEqual(thirdConfig);

    await act(async () => {
      firstSave.resolve({ data: firstConfig, success: true });
      await firstSave.promise;
    });
    await waitFor(() => expect(saveIndex).toBe(2));
    act(() => {
      storage.emitConfigChange(secondConfig);
    });
    expect(result.current.config).toEqual(thirdConfig);
    await act(async () => {
      secondSave.resolve({ data: secondConfig, success: true });
      await secondSave.promise;
    });
    await waitFor(() => expect(saveIndex).toBe(3));
    act(() => {
      storage.emitConfigChange(thirdConfig);
    });
    await act(async () => {
      thirdSave.resolve({ data: thirdConfig, success: true });
      await thirdSave.promise;
    });
    await waitFor(() => expect(result.current.saveState).toBe("saved"));

    expect(sendMessage).toHaveBeenLastCalledWith({
      payload: thirdConfig,
      type: "SET_CONFIG",
    });
  });

  it("ignores invalid or non-sync storage changes", async () => {
    const sendMessage = vi.fn<() => Promise<unknown>>(() =>
      Promise.resolve({ data: CONFIG, success: true }),
    );
    const storage = stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      storage.emitConfigChange({ ...CONFIG, favorites: ["UNKNOWN"] });
      storage.emitConfigChange({ ...CONFIG, theme: "dark" }, "local");
    });

    expect(result.current.config).toEqual(CONFIG);
  });

  it("rolls back a failed save to the latest synchronized configuration", async () => {
    const rejectedSave = Promise.withResolvers<unknown>();
    const synchronizedConfig: Config = { ...CONFIG, showCurrencyCode: false };
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ data: CONFIG, success: true })
        : rejectedSave.promise,
    );
    const storage = stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
    });
    await waitFor(() => expect(result.current.saveState).toBe("saving"));
    act(() => {
      storage.emitConfigChange(synchronizedConfig);
    });

    await act(async () => {
      rejectedSave.reject(new Error("Save rejected"));
      await rejectedSave.promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.saveState).toBe("error"));

    expect(result.current.config).toEqual(synchronizedConfig);
    expect(result.current.error).toBe("Save rejected");
  });

  it("keeps newer synchronized data after an in-flight save succeeds", async () => {
    const pendingSave = Promise.withResolvers<unknown>();
    const localConfig: Config = { ...CONFIG, theme: "dark" };
    const synchronizedConfig: Config = { ...CONFIG, showCurrencyCode: false };
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ data: CONFIG, success: true })
        : pendingSave.promise,
    );
    const storage = stubBrowserBoundary(sendMessage);
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig(() => localConfig);
    });
    await waitFor(() => expect(result.current.saveState).toBe("saving"));
    act(() => {
      storage.emitConfigChange(synchronizedConfig);
    });

    await act(async () => {
      pendingSave.resolve({ data: localConfig, success: true });
      await pendingSave.promise;
    });
    await waitFor(() => expect(result.current.saveState).toBe("saved"));

    expect(result.current.config).toEqual(synchronizedConfig);
  });

  it("removes the storage listener on cleanup", async () => {
    const storage = stubBrowserBoundary(
      vi.fn<() => Promise<unknown>>(() => Promise.resolve({ data: CONFIG, success: true })),
    );
    const { unmount } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(storage.addListener).toHaveBeenCalledOnce());
    const listener = storage.addListener.mock.calls[0]?.[0];

    unmount();

    expect(listener).toBeDefined();
    expect(storage.removeListener).toHaveBeenCalledWith(listener);
  });
});

type StorageChangeListener = Parameters<typeof browser.storage.onChanged.addListener>[0];

/** Installs the runtime and synchronized-storage boundaries used by the hook. */
function stubBrowserBoundary(sendMessage: (message: unknown) => Promise<unknown>) {
  const listeners = new Set<StorageChangeListener>();
  const addListener = vi.fn<(listener: StorageChangeListener) => void>((listener) => {
    listeners.add(listener);
  });
  const removeListener = vi.fn<(listener: StorageChangeListener) => void>((listener) => {
    listeners.delete(listener);
  });
  vi.stubGlobal("browser", {
    runtime: { sendMessage },
    storage: { onChanged: { addListener, removeListener } },
  });

  return {
    addListener,
    emitConfigChange(
      newValue: unknown,
      areaName: Parameters<StorageChangeListener>[1] = "sync",
    ): void {
      for (const listener of listeners) {
        listener({ config: { newValue } }, areaName);
      }
    },
    removeListener,
  };
}

/** Reads only the message discriminant used by the browser boundary mock. */
function readMessageType(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "type")
    : undefined;
}
