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
import { messageTypes, sendMessage } from "@/lib/messages";
import { CHART_COLORS_KEY, parseStoredChartColorSettings } from "@/lib/storage";
import {
  getTrendPalette,
  type ChangeDirection,
  type ChartColorSettings,
  type TrendPalette,
} from "@/lib/trend-colors";

export interface ChartColorsState {
  /** True after the latest save failed and the last stored choice was restored. */
  readonly saveFailed: boolean;
  readonly settings: ChartColorSettings;
  /** Sets one direction's color, or returns it to the default with null. */
  readonly setColor: (direction: ChangeDirection, color: string | null) => void;
}

interface ChartColorsStore extends StoreApi<ChartColorsState> {
  readonly startSynchronization: () => () => void;
}

interface ChartColorsProviderProps {
  readonly children: ReactNode;
  readonly preview?: ChartColorSettings | undefined;
}

const ChartColorsContext = createContext<ChartColorsStore | null>(null);

/** Keeps the chart color choices of one popup or conversion card in step with synchronized storage. */
export function ChartColorsProvider({ children, preview }: ChartColorsProviderProps) {
  const [store] = useState(() => createChartColorsStore(preview));

  useEffect(() => store.startSynchronization(), [store]);

  return (
    <ChartColorsContext.Provider value={store}>{children}</ChartColorsContext.Provider>
  );
}

/** Selects chart color state or actions from the nearest provider. */
export function useChartColors<Selected>(
  selector: (state: ChartColorsState) => Selected,
): Selected {
  const store = useContext(ChartColorsContext);
  if (store === null) {
    throw new Error("useChartColors must be used within ChartColorsProvider.");
  }
  return useStore(store, selector);
}

/** Resolves the rise, fall, and flat colors from the defaults and the user's choices. */
export function useTrendPalette(): TrendPalette {
  const settings = useChartColors((state) => state.settings);
  return useMemo(() => getTrendPalette(settings), [settings]);
}

/** Creates one provider's chart color store and its storage synchronization. */
function createChartColorsStore(preview: ChartColorSettings | undefined): ChartColorsStore {
  let lastStored: ChartColorSettings = preview ?? {};
  let latestRevision = 0;
  let pendingSaves = 0;
  let saveQueue = Promise.resolve();

  const store = createStore<ChartColorsState>()((set, get) => ({
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
      // Only the changed direction is sent; the background merges it into storage, so a
      // choice made in another popup for the other direction is never overwritten.
      const save = saveQueue.then(async () => {
        const response = await sendMessage({
          type: messageTypes.SET_CHART_COLORS,
          payload: { color, direction },
        });
        if (!response.success) {
          throw new Error(response.error);
        }
        lastStored = response.data;
        return undefined;
      });
      const settled = save.then(
        () => false,
        () => true,
      );
      saveQueue = settled.then(() => undefined);
      void settled.then(async (failed) => {
        pendingSaves -= 1;
        if (failed && revision === latestRevision) {
          set({ saveFailed: true });
        }
        if (pendingSaves === 0) {
          await reconcile();
        }
        return undefined;
      });
    },
  }));

  /**
   * Shows what storage holds once no save is pending. Storage events seen while saving
   * may be older or newer than the responses, so the stored value is read again.
   */
  const reconcile = async () => {
    try {
      const response = await sendMessage({ type: messageTypes.GET_CHART_COLORS });
      if (response.success) {
        lastStored = response.data;
      }
    } catch {
      // Fall back to the newest value this popup has already seen.
    }
    if (pendingSaves === 0) {
      store.setState({ settings: lastStored });
    }
  };

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
