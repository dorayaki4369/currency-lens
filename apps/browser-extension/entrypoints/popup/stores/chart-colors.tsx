import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { UiLocale } from "@/lib/i18n";
import { messageTypes, sendMessage } from "@/lib/messages";
import { CHART_COLORS_KEY, parseStoredChartColorSettings } from "@/lib/storage";
import {
  getTrendColorScheme,
  getTrendPalette,
  type ChangeDirection,
  type ChartColorSettings,
  type TrendPalette,
} from "@/lib/trend-colors";

export interface PopupChartColorsState {
  /** True after the latest save failed and the last stored choice was restored. */
  readonly saveFailed: boolean;
  readonly settings: ChartColorSettings;
  /** Sets one direction's color, or returns it to the default with null. */
  readonly setColor: (direction: ChangeDirection, color: string | null) => void;
}

interface ChartColorsStore extends StoreApi<PopupChartColorsState> {
  readonly startSynchronization: () => () => void;
}

interface PopupChartColorsProviderProps {
  readonly children: ReactNode;
  readonly preview?: ChartColorSettings | undefined;
}

const PopupChartColorsContext = createContext<ChartColorsStore | null>(null);

/** Keeps the chart color choices of one popup in step with synchronized storage. */
export function PopupChartColorsProvider({
  children,
  preview,
}: PopupChartColorsProviderProps) {
  const [store] = useState(() => createChartColorsStore(preview));

  useEffect(() => store.startSynchronization(), [store]);

  return (
    <PopupChartColorsContext.Provider value={store}>
      {children}
    </PopupChartColorsContext.Provider>
  );
}

/** Selects chart color state or actions from the current popup instance. */
export function usePopupChartColors<Selected>(
  selector: (state: PopupChartColorsState) => Selected,
): Selected {
  const store = useContext(PopupChartColorsContext);
  if (store === null) {
    throw new Error("usePopupChartColors must be used within PopupChartColorsProvider.");
  }
  return useStore(store, selector);
}

/** Resolves the rise, fall, and flat colors for the UI locale and the user's choices. */
export function useTrendPalette(locale: UiLocale): TrendPalette {
  const settings = usePopupChartColors((state) => state.settings);
  return useMemo(
    () => getTrendPalette(getTrendColorScheme(locale), settings),
    [locale, settings],
  );
}

/** Creates one popup's chart color store and its storage synchronization. */
function createChartColorsStore(preview: ChartColorSettings | undefined): ChartColorsStore {
  let lastStored: ChartColorSettings = preview ?? {};
  let latestRevision = 0;
  let pendingSaves = 0;
  let saveQueue = Promise.resolve();

  const store = createStore<PopupChartColorsState>()((set, get) => ({
    saveFailed: false,
    settings: preview ?? {},
    setColor: (direction, color) => {
      const next: ChartColorSettings = { ...get().settings };
      if (color === null) {
        delete next[direction];
      } else {
        next[direction] = color;
      }
      set({ saveFailed: false, settings: next });
      if (preview !== undefined) {
        return;
      }

      latestRevision += 1;
      pendingSaves += 1;
      const revision = latestRevision;
      const save = saveQueue.then(async () => {
        const response = await sendMessage({
          type: messageTypes.SET_CHART_COLORS,
          payload: next,
        });
        if (!response.success) {
          throw new Error(response.error);
        }
        lastStored = response.data;
        return undefined;
      });
      saveQueue = save
        .catch(() => undefined)
        .finally(() => {
          pendingSaves -= 1;
        });
      void save.catch(() => {
        // Only the newest choice decides what the screen shows after a failure.
        if (revision === latestRevision) {
          set({ saveFailed: true, settings: lastStored });
        }
      });
    },
  }));

  const startSynchronization = () => {
    if (preview !== undefined) {
      return () => undefined;
    }

    let active = true;
    let changedBeforeLoad = false;
    const handleStorageChange: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (!active || areaName !== "sync" || !Object.hasOwn(changes, CHART_COLORS_KEY)) {
        return;
      }
      changedBeforeLoad = true;
      lastStored = parseStoredChartColorSettings(changes[CHART_COLORS_KEY]?.newValue);
      // Echoes of this popup's own saves would briefly undo a newer pending choice.
      if (pendingSaves === 0) {
        store.setState({ settings: lastStored });
      }
    };
    const load = async () => {
      try {
        const response = await sendMessage({ type: messageTypes.GET_CHART_COLORS });
        if (active && !changedBeforeLoad && response.success) {
          lastStored = response.data;
          store.setState({ settings: response.data });
        }
      } catch {
        // The locale defaults stay in use until storage reports a choice.
      }
    };

    const storageChanges = browser.storage?.onChanged;
    storageChanges?.addListener(handleStorageChange);
    void load();
    return () => {
      active = false;
      storageChanges?.removeListener(handleStorageChange);
    };
  };

  return Object.assign(store, { startSynchronization });
}
