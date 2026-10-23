import type { CurrencyCode } from "@cl/currency";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { messageTypes, sendMessage, type GetRatesResponse } from "@/lib/messages";

export type PopupRatesData = Extract<GetRatesResponse, { success: true }>["data"];

export type PopupRatesState =
  | { readonly data: PopupRatesData | null; readonly status: "loading" }
  | { readonly data: PopupRatesData; readonly status: "ready" }
  | { readonly data: null; readonly status: "unavailable" };

export interface PopupConversionState {
  readonly rates: PopupRatesState;
  readonly sourceAmount: string;
  readonly sourceCurrency: CurrencyCode;
  readonly loadRates: () => Promise<void>;
  readonly setSourceAmount: (amount: string) => void;
  readonly setSourceCurrency: (currencyCode: CurrencyCode) => void;
}

interface PopupConversionProviderProps {
  readonly children: ReactNode;
  readonly previewRates?: PopupRatesData | undefined;
}

const PopupConversionContext = createContext<StoreApi<PopupConversionState> | null>(null);

/** Preserves popup conversion values while the user navigates between popup routes. */
export function PopupConversionProvider({
  children,
  previewRates,
}: PopupConversionProviderProps) {
  const [store] = useState(() => createPopupConversionStore(previewRates));

  useEffect(() => {
    void store.getState().loadRates();
  }, [store]);

  return (
    <PopupConversionContext.Provider value={store}>
      {children}
    </PopupConversionContext.Provider>
  );
}

/** Selects popup conversion values or actions from the current popup instance. */
export function usePopupConversion<Selected>(
  selector: (state: PopupConversionState) => Selected,
): Selected {
  const store = useContext(PopupConversionContext);
  if (store === null) {
    throw new Error("usePopupConversion must be used within PopupConversionProvider.");
  }
  return useStore(store, selector);
}

/** Creates one popup instance's transient state. */
function createPopupConversionStore(
  previewRates: PopupRatesData | undefined,
): StoreApi<PopupConversionState> {
  let activeLoad: Promise<void> | null = null;

  return createStore<PopupConversionState>()((set, get) => ({
    rates:
      previewRates === undefined
        ? { data: null, status: "loading" }
        : { data: previewRates, status: "ready" },
    sourceAmount: "1",
    sourceCurrency: "USD",
    loadRates: () => {
      if (previewRates !== undefined) {
        return Promise.resolve();
      }

      if (activeLoad !== null) {
        return activeLoad;
      }

      const previousRates = get().rates.data;
      set({ rates: { data: previousRates, status: "loading" } });
      activeLoad = requestRates(previousRates, (rates) => set({ rates })).finally(() => {
        activeLoad = null;
      });
      return activeLoad;
    },
    setSourceAmount: (sourceAmount) => set({ sourceAmount }),
    setSourceCurrency: (sourceCurrency) => set({ sourceCurrency }),
  }));
}

/** Loads validated rates and restores the latest usable fallback on failure. */
async function requestRates(
  fallbackRates: PopupRatesData | null,
  setRates: (rates: PopupRatesState) => void,
): Promise<void> {
  let rates: PopupRatesState =
    fallbackRates === null
      ? { data: null, status: "unavailable" }
      : { data: fallbackRates, status: "ready" };
  try {
    const response = await sendMessage({ type: messageTypes.GET_RATES });
    if (response.success) {
      rates = { data: response.data, status: "ready" };
    }
  } catch {
    // Keep the fallback when the runtime boundary is unavailable or returns invalid data.
  }
  setRates(rates);
}
