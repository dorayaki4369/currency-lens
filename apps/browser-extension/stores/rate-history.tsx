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

/**
 * Chooses every target at once. Currency codes never contain "*", so the choice can never
 * collide with one, such as the Albanian lek's code ALL.
 */
export const ALL_CURRENCIES_SELECTION = "*";

export type RateChartSelection = CurrencyCode | typeof ALL_CURRENCIES_SELECTION;

/** Fixed history for previews and tests; a preview never touches the network. */
export type RateHistoryPreview =
  | { readonly kind: "data"; readonly daily: RateHistory; readonly hourly: RateHistory }
  | { readonly kind: "empty" }
  | { readonly kind: "error" }
  | { readonly kind: "loading" };

export interface RateHistoryState {
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

interface RateHistoryProviderProps {
  readonly children: ReactNode;
  readonly preview?: RateHistoryPreview | undefined;
}

const LOADING_ENTRY: RateHistoryEntry = { data: null, status: "loading" };
// With nothing to request (only USD involved), there is simply no history to draw.
const NO_SYMBOL_ENTRIES = {
  daily: { data: createEmptyHistory("daily"), status: "ready" },
  hourly: { data: createEmptyHistory("hourly"), status: "ready" },
} as const satisfies Record<RateHistoryResolution, RateHistoryEntry>;

const RateHistoryContext = createContext<StoreApi<RateHistoryState> | null>(null);

/** Keeps loaded histories and chart choices for the lifetime of one popup or conversion card. */
export function RateHistoryProvider({ children, preview }: RateHistoryProviderProps) {
  const [store] = useState(() => createRateHistoryStore(preview));
  return (
    <RateHistoryContext.Provider value={store}>{children}</RateHistoryContext.Provider>
  );
}

/** Selects rate history state or actions from the nearest provider. */
export function useRateHistoryStore<Selected>(
  selector: (state: RateHistoryState) => Selected,
): Selected {
  const store = useContext(RateHistoryContext);
  if (store === null) {
    throw new Error("useRateHistoryStore must be used within RateHistoryProvider.");
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
  const entry = useRateHistoryStore((state) =>
    key === null ? NO_SYMBOL_ENTRIES[resolution] : (state.entries[key] ?? LOADING_ENTRY),
  );
  const loadHistory = useRateHistoryStore((state) => state.loadHistory);

  useEffect(() => {
    if (symbols.length > 0) {
      void loadHistory(resolution, symbols);
    }
  }, [loadHistory, resolution, symbols]);

  return entry;
}

/** Creates one provider's history cache and chart choices. */
function createRateHistoryStore(
  preview: RateHistoryPreview | undefined,
): StoreApi<RateHistoryState> {
  const activeLoads = new Map<string, Promise<void>>();

  return createStore<RateHistoryState>()((set, get) => {
    const setEntry = (key: string, entry: RateHistoryEntry) =>
      set((state) => ({ entries: { ...state.entries, [key]: entry } }));

    return {
      entries: {},
      period: "1M",
      selection: ALL_CURRENCIES_SELECTION,
      loadHistory: (resolution, symbols) => {
        const key = getRateHistoryKey({ resolution, symbols });
        // Loaded windows stay for the provider's lifetime; only failures are retried.
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
