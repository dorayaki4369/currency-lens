import type { CurrencyCode } from "@cl/currency";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { messageTypes, sendMessage } from "@/lib/messages";
import {
  getRateHistoryKey,
  type RateHistory,
  type RateHistoryResolution,
} from "@/lib/rate-history";
import type { RatePeriod } from "@/lib/rate-series";

export type RateHistoryEntry =
  | { readonly data: null; readonly status: "error" }
  | { readonly data: null; readonly status: "loading" }
  | { readonly data: RateHistory; readonly status: "ready" };

export type RateChartSelection = CurrencyCode | "ALL";

/** Fixed history for previews and tests; a preview never touches the network. */
export type RateHistoryPreview =
  | { readonly kind: "data"; readonly daily: RateHistory; readonly hourly: RateHistory }
  | { readonly kind: "empty" }
  | { readonly kind: "error" }
  | { readonly kind: "loading" };

export interface PopupRateHistoryState {
  readonly entries: Readonly<Record<string, RateHistoryEntry>>;
  readonly period: RatePeriod;
  readonly selection: RateChartSelection;
  readonly loadHistory: (
    resolution: RateHistoryResolution,
    symbols: readonly CurrencyCode[],
  ) => Promise<void>;
  readonly setPeriod: (period: RatePeriod) => void;
  readonly setSelection: (selection: RateChartSelection) => void;
}

interface PopupRateHistoryProviderProps {
  readonly children: ReactNode;
  readonly preview?: RateHistoryPreview | undefined;
}

const LOADING_ENTRY: RateHistoryEntry = { data: null, status: "loading" };
// With nothing to request (only USD involved), there is simply no history to draw.
const NO_SYMBOL_ENTRIES = {
  daily: { data: createEmptyHistory("daily"), status: "ready" },
  hourly: { data: createEmptyHistory("hourly"), status: "ready" },
} as const satisfies Record<RateHistoryResolution, RateHistoryEntry>;

const PopupRateHistoryContext = createContext<StoreApi<PopupRateHistoryState> | null>(null);

/** Keeps loaded histories and chart choices for the lifetime of one popup. */
export function PopupRateHistoryProvider({
  children,
  preview,
}: PopupRateHistoryProviderProps) {
  const [store] = useState(() => createPopupRateHistoryStore(preview));
  return (
    <PopupRateHistoryContext.Provider value={store}>
      {children}
    </PopupRateHistoryContext.Provider>
  );
}

/** Selects rate history state or actions from the current popup instance. */
export function usePopupRateHistory<Selected>(
  selector: (state: PopupRateHistoryState) => Selected,
): Selected {
  const store = useContext(PopupRateHistoryContext);
  if (store === null) {
    throw new Error("usePopupRateHistory must be used within PopupRateHistoryProvider.");
  }
  return useStore(store, selector);
}

/**
 * Requests one history window when first needed and returns its current state.
 * Callers memoize `symbols` so the request runs once per symbol set.
 */
export function useRateHistory(
  resolution: RateHistoryResolution,
  symbols: readonly CurrencyCode[],
): RateHistoryEntry {
  const key = symbols.length === 0 ? null : getRateHistoryKey({ resolution, symbols });
  const entry = usePopupRateHistory((state) =>
    key === null ? NO_SYMBOL_ENTRIES[resolution] : (state.entries[key] ?? LOADING_ENTRY),
  );
  const loadHistory = usePopupRateHistory((state) => state.loadHistory);

  useEffect(() => {
    if (symbols.length > 0) {
      void loadHistory(resolution, symbols);
    }
  }, [loadHistory, resolution, symbols]);

  return entry;
}

/** Creates one popup instance's history cache and chart choices. */
function createPopupRateHistoryStore(
  preview: RateHistoryPreview | undefined,
): StoreApi<PopupRateHistoryState> {
  const activeLoads = new Map<string, Promise<void>>();

  return createStore<PopupRateHistoryState>()((set, get) => {
    const setEntry = (key: string, entry: RateHistoryEntry) =>
      set((state) => ({ entries: { ...state.entries, [key]: entry } }));

    return {
      entries: {},
      period: "1M",
      selection: "ALL",
      loadHistory: (resolution, symbols) => {
        const key = getRateHistoryKey({ resolution, symbols });
        // Loaded windows stay for the popup's lifetime; only failures are retried.
        if (get().entries[key]?.status === "ready") {
          return Promise.resolve();
        }
        const active = activeLoads.get(key);
        if (active !== undefined) {
          return active;
        }

        setEntry(key, LOADING_ENTRY);
        const load = requestHistory(resolution, symbols, preview).then((entry) => {
          if (entry !== null) {
            setEntry(key, entry);
          }
          return undefined;
        });
        const tracked = load.finally(() => activeLoads.delete(key));
        activeLoads.set(key, tracked);
        return tracked;
      },
      setPeriod: (period) => set({ period }),
      setSelection: (selection) => set({ selection }),
    };
  });
}

/**
 * Resolves one history request into its final state, or null while a loading preview
 * should stay pending. Runtime failures become an error state instead of a rejection.
 */
async function requestHistory(
  resolution: RateHistoryResolution,
  symbols: readonly CurrencyCode[],
  preview: RateHistoryPreview | undefined,
): Promise<RateHistoryEntry | null> {
  if (preview !== undefined) {
    return resolvePreviewHistory(preview, resolution, symbols);
  }
  try {
    const response = await sendMessage({
      type: messageTypes.GET_RATE_HISTORY,
      payload: { resolution, symbols: [...symbols] },
    });
    return response.success
      ? { data: response.data, status: "ready" }
      : { data: null, status: "error" };
  } catch {
    return { data: null, status: "error" };
  }
}

/** Serves the requested symbols from fixed preview history. */
function resolvePreviewHistory(
  preview: RateHistoryPreview,
  resolution: RateHistoryResolution,
  symbols: readonly CurrencyCode[],
): RateHistoryEntry | null {
  if (preview.kind === "loading") {
    return null;
  }
  if (preview.kind === "error") {
    return { data: null, status: "error" };
  }
  const history =
    preview.kind === "data" ? preview[resolution] : createEmptyHistory(resolution);
  const rates = Object.fromEntries(
    symbols.flatMap((symbol) => {
      const series = history.rates[symbol];
      return series === undefined ? [] : [[symbol, series] as const];
    }),
  );
  return { data: { ...history, rates }, status: "ready" };
}

/** Builds a valid history window with no series. */
function createEmptyHistory(resolution: RateHistoryResolution): RateHistory {
  return { base: "USD", rates: {}, resolution, start: new Date(0).toISOString() };
}
