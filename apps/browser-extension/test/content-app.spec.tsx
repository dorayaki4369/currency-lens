// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrencyCode } from "@cl/currency";
import type { Config } from "../lib/currency";
import type { DetectedCurrency } from "../lib/currency-detection";

const mocks = vi.hoisted(() => ({
  conversion: {
    convert: vi.fn<
      (
        detectedCurrency: DetectedCurrency | null,
        targetCurrencies: readonly CurrencyCode[],
      ) => Promise<void>
    >(() => Promise.resolve()),
    data: null,
    error: null,
    loading: false,
    reset: vi.fn<() => void>(),
  },
  detections: [] as DetectedCurrency[],
  floating: {
    setFloating: vi.fn<(element: HTMLElement | null) => void>(),
    setReference: vi.fn<(reference: unknown) => void>(),
  },
  selection: null as { readonly rect: DOMRect; readonly text: string } | null,
  useCurrencyDetection: vi.fn<(...arguments_: unknown[]) => void>(),
}));

vi.mock("@floating-ui/react-dom", () => ({
  autoUpdate: vi.fn<() => void>(),
  flip: vi.fn<() => { readonly name: string }>(() => ({ name: "flip" })),
  offset: vi.fn<() => { readonly name: string }>(() => ({ name: "offset" })),
  shift: vi.fn<() => { readonly name: string }>(() => ({ name: "shift" })),
  useFloating: vi.fn<() => unknown>(() => ({
    floatingStyles: { position: "fixed" },
    refs: mocks.floating,
  })),
}));

vi.mock("../entrypoints/content/hooks/useSelection", () => ({
  useSelection: () => mocks.selection,
}));

vi.mock("../entrypoints/content/hooks/useCurrencyDetection", () => ({
  useCurrencyDetection: (...arguments_: unknown[]) => {
    mocks.useCurrencyDetection(...arguments_);
    return mocks.detections;
  },
}));

vi.mock("../entrypoints/content/hooks/useConversion", () => ({
  useConversion: () => mocks.conversion,
}));

import App from "../entrypoints/content/App";

const DETECTION: DetectedCurrency = {
  amount: 10,
  currencyCode: "USD",
  index: 0,
  originalText: "$10",
};

const CONFIG: Config = {
  favorites: ["JPY"],
  showCurrencyCode: true,
  showCurrencyIcon: true,
  symbolOverrides: { $: "USD" },
  theme: "light",
};

beforeEach(() => {
  mocks.conversion.convert.mockReset();
  mocks.conversion.reset.mockReset();
  mocks.detections = [];
  mocks.floating.setFloating.mockReset();
  mocks.floating.setReference.mockReset();
  mocks.selection = null;
  mocks.useCurrencyDetection.mockReset();
  document.documentElement.lang = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("content App", () => {
  it("loads configuration, positions the trigger, converts, and restores focus", async () => {
    const browserMock = installBrowser(() => Promise.resolve(successfulConfig(CONFIG)));
    const rect = new DOMRect(5, 6, 7, 8);
    mocks.selection = { rect, text: "$10" };
    mocks.detections = [DETECTION];
    document.documentElement.lang = "fr-FR";

    const { rerender } = render(<App />);
    const trigger = await screen.findByRole("button", { name: "Convert selected price" });

    expect(trigger.closest(".cl-root")?.className).toContain("cl-theme-light");
    expect(mocks.useCurrencyDetection).toHaveBeenCalledWith("$10", {
      browserLocale: "en-US",
      pageLocale: "fr-FR",
      symbolOverrides: { $: "USD" },
    });
    const virtualReference = mocks.floating.setReference.mock.calls.at(-1)?.[0] as {
      getBoundingClientRect: () => DOMRect;
      getClientRects: () => DOMRect[];
    };
    expect(virtualReference.getBoundingClientRect()).toBe(rect);
    expect(virtualReference.getClientRects()).toEqual([rect]);

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(mocks.conversion.convert).toHaveBeenCalledWith(DETECTION, ["JPY"]);
    });
    expect(screen.getByRole("dialog", { name: "Currency Lens" })).toBeDefined();

    const changedDetection: DetectedCurrency = {
      ...DETECTION,
      amount: 20,
      originalText: "$20",
    };
    mocks.detections = [changedDetection];
    rerender(<App />);
    await waitFor(() => {
      expect(mocks.conversion.convert).toHaveBeenLastCalledWith(changedDetection, ["JPY"]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Close Currency Lens" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Convert selected price" })).toBe(
        document.activeElement,
      );
    });
    expect(mocks.conversion.reset).toHaveBeenCalled();
    expect(browserMock.storage.onChanged.addListener).toHaveBeenCalledOnce();
  });

  it("keeps focus on an outside target when that pointer dismisses the card", async () => {
    installBrowser(() => Promise.resolve(successfulConfig(CONFIG)));
    mocks.selection = { rect: new DOMRect(0, 0, 10, 10), text: "$10" };
    mocks.detections = [DETECTION];
    render(
      <>
        <button type="button">Host action</button>
        <App />
      </>,
    );
    const trigger = await screen.findByRole("button", { name: "Convert selected price" });
    fireEvent.click(trigger);
    const hostAction = screen.getByRole("button", { name: "Host action" });
    hostAction.focus();

    fireEvent.pointerDown(hostAction);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(hostAction);
  });

  it("closes the conversion state when an open selection stops matching money", async () => {
    installBrowser(() => Promise.resolve(successfulConfig(CONFIG)));
    mocks.selection = { rect: new DOMRect(0, 0, 10, 10), text: "$10" };
    mocks.detections = [DETECTION];
    const { rerender } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Convert selected price" }));
    expect(screen.getByRole("dialog")).toBeDefined();

    mocks.detections = [];
    rerender(<App />);

    await waitFor(() => {
      expect(screen.getByText("No supported monetary amount was found.")).toBeDefined();
    });
  });

  it("reloads only relevant sync storage changes", async () => {
    const updatedConfig: Config = { ...CONFIG, favorites: ["EUR"], theme: "dark" };
    const sendMessage = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(successfulConfig(CONFIG))
      .mockResolvedValueOnce(successfulConfig(updatedConfig));
    const browserMock = installBrowser(sendMessage);
    mocks.selection = { rect: new DOMRect(0, 0, 10, 10), text: "$10" };
    mocks.detections = [DETECTION];
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "Convert selected price" });
    const listener = browserMock.getStorageListener();

    act(() => listener({ config: {} }, "local"));
    act(() => listener({ unrelated: {} }, "sync"));
    expect(sendMessage).toHaveBeenCalledOnce();

    act(() => listener({ config: {} }, "sync"));
    await waitFor(() => {
      expect(container.querySelector(".cl-theme-dark")).not.toBeNull();
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("ignores an older configuration response", async () => {
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    const sendMessage = vi
      .fn<() => Promise<unknown>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const browserMock = installBrowser(sendMessage);
    mocks.selection = { rect: new DOMRect(0, 0, 10, 10), text: "$10" };
    mocks.detections = [DETECTION];
    const { container } = render(<App />);
    const listener = browserMock.getStorageListener();

    act(() => listener({ config: {} }, "sync"));
    await act(async () => {
      second.resolve(successfulConfig({ ...CONFIG, theme: "dark" }));
      await second.promise;
    });
    await act(async () => {
      first.resolve(successfulConfig(CONFIG));
      await first.promise;
    });

    expect(container.querySelector(".cl-theme-dark")).not.toBeNull();
    expect(container.querySelector(".cl-theme-light")).toBeNull();
  });

  it("keeps configuration empty for background failures and unsuccessful responses", async () => {
    const sendMessage = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ error: "still offline", success: false });
    const browserMock = installBrowser(sendMessage);
    mocks.selection = { rect: new DOMRect(0, 0, 10, 10), text: "$10" };
    mocks.detections = [DETECTION];
    const { container } = render(<App />);
    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());

    expect(screen.queryByRole("button", { name: "Convert selected price" })).toBeNull();
    expect(container.querySelector(".cl-theme-system")).not.toBeNull();

    act(() => browserMock.getStorageListener()({ config: {} }, "sync"));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Convert selected price" })).toBeNull();
  });

  it("does not update state after unmount and removes the storage listener", async () => {
    const response = Promise.withResolvers<unknown>();
    const browserMock = installBrowser(() => response.promise);
    const { unmount } = render(<App />);

    unmount();
    await act(async () => {
      response.resolve(successfulConfig(CONFIG));
      await response.promise;
    });

    expect(browserMock.storage.onChanged.removeListener).toHaveBeenCalledOnce();
  });

  it("does not handle a rejection after unmount", async () => {
    const response = Promise.withResolvers<unknown>();
    installBrowser(() => response.promise);
    const { unmount } = render(<App />);

    unmount();
    await act(async () => {
      response.reject(new Error("late failure"));
      await expect(response.promise).rejects.toThrow("late failure");
    });

    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["there is no selection", [DETECTION], null, false],
    [
      "the selection has no supported money",
      [],
      { rect: new DOMRect(0, 0, 10, 10), text: "hello" },
      true,
    ],
  ])(
    "does not show the trigger when %s",
    async (_description, detections, selection, positionsSelection) => {
      installBrowser(() => Promise.resolve(successfulConfig(CONFIG)));
      mocks.detections = detections;
      mocks.selection = selection;
      render(<App />);

      await waitFor(() => expect(mocks.useCurrencyDetection).toHaveBeenCalled());

      expect(screen.queryByRole("button", { name: "Convert selected price" })).toBeNull();
      expect(mocks.floating.setReference).toHaveBeenCalledTimes(positionsSelection ? 1 : 0);
    },
  );
});

function successfulConfig(config: Config): unknown {
  return { data: config, success: true };
}

function installBrowser(sendMessage: () => Promise<unknown>) {
  let storageListener:
    | ((changes: Record<string, unknown>, areaName: string) => void)
    | undefined;
  const browserMock = {
    i18n: { getUILanguage: vi.fn<() => string>(() => "en-US") },
    runtime: { sendMessage: vi.fn<() => Promise<unknown>>(sendMessage) },
    storage: {
      onChanged: {
        addListener: vi.fn<
          (listener: (changes: Record<string, unknown>, areaName: string) => void) => void
        >((listener: (changes: Record<string, unknown>, areaName: string) => void) => {
          storageListener = listener;
        }),
        removeListener:
          vi.fn<
            (listener: (changes: Record<string, unknown>, areaName: string) => void) => void
          >(),
      },
    },
    getStorageListener: () => {
      if (storageListener === undefined) {
        throw new Error("Storage listener was not registered");
      }
      return storageListener;
    },
  };
  vi.stubGlobal("browser", browserMock);
  return browserMock;
}
