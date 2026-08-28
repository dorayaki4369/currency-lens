// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
    vi.stubGlobal("browser", { runtime: { sendMessage } });
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
    vi.stubGlobal("browser", { runtime: { sendMessage } });
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
    vi.stubGlobal("browser", {
      runtime: {
        sendMessage: vi.fn<() => Promise<unknown>>(() => Promise.reject(failure)),
      },
    });
    const { result } = renderHook(() => useConfigSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(expectedMessage);
  });

  it("does not update state after an in-flight load is unmounted", async () => {
    const load = Promise.withResolvers<unknown>();
    vi.stubGlobal("browser", {
      runtime: { sendMessage: vi.fn<() => Promise<unknown>>(() => load.promise) },
    });
    const { unmount } = renderHook(() => useConfigSettings());

    unmount();
    await act(async () => {
      load.resolve({ data: CONFIG, success: true });
      await load.promise;
    });

    await expect(load.promise).resolves.toEqual({ data: CONFIG, success: true });
  });

  it("does not report an in-flight load rejection after unmounting", async () => {
    const load = Promise.withResolvers<unknown>();
    vi.stubGlobal("browser", {
      runtime: { sendMessage: vi.fn<() => Promise<unknown>>(() => load.promise) },
    });
    const { unmount } = renderHook(() => useConfigSettings());

    unmount();
    await act(async () => {
      load.reject(new Error("Browser disconnected"));
      await load.promise.catch(() => undefined);
    });

    await expect(load.promise).rejects.toThrow("Browser disconnected");
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
    vi.stubGlobal("browser", { runtime: { sendMessage } });
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
    vi.stubGlobal("browser", { runtime: { sendMessage } });
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
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConfigSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, theme: "dark" }));
    });
    await waitFor(() => expect(result.current.saveState).toBe("error"));

    expect(result.current.config).toEqual(CONFIG);
    expect(result.current.error).toBe("Settings could not be saved.");
  });
});

/** Reads only the message discriminant used by the browser boundary mock. */
function readMessageType(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "type")
    : undefined;
}
