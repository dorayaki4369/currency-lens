import type { CurrencyCode } from "@cl/currency";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { configSchema, type Config } from "@/lib/currency";
import { moveCurrencyRelative, type CurrencyDropPlacement } from "@/lib/currency-order";
import { messageTypes, sendMessage } from "@/lib/messages";
import { parseStoredConfig } from "@/lib/storage";

export type ConfigSaveState = "idle" | "saving" | "saved" | "error";

const CONFIG_STORAGE_KEY = "config";

export interface ConfigStoreState {
  readonly config: Config | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly saveState: ConfigSaveState;
  readonly addFavorite: (currencyCode: CurrencyCode) => void;
  readonly removeFavorite: (currencyCode: CurrencyCode) => void;
  readonly reorderFavorite: (
    sourceCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
    placement: CurrencyDropPlacement,
  ) => void;
  readonly updateConfig: (update: (current: Config) => Config) => void;
}

interface ConfigStore extends StoreApi<ConfigStoreState> {
  readonly startSynchronization: () => () => void;
}

interface ConfigStoreProviderProps {
  readonly children: ReactNode;
  readonly previewConfig?: Config | undefined;
}

const ConfigStoreContext = createContext<ConfigStore | null>(null);

/** Provides one configuration store instance to a browser-extension UI root. */
export function ConfigStoreProvider({ children, previewConfig }: ConfigStoreProviderProps) {
  const [store] = useState(() => createConfigStore(previewConfig));

  useEffect(() => store.startSynchronization(), [store]);

  return (
    <ConfigStoreContext.Provider value={store}>{children}</ConfigStoreContext.Provider>
  );
}

/** Selects configuration state or actions from the nearest UI-root store. */
export function useConfigStore<Selected>(
  selector: (state: ConfigStoreState) => Selected,
): Selected {
  const store = useContext(ConfigStoreContext);
  if (store === null) {
    throw new Error("useConfigStore must be used within ConfigStoreProvider.");
  }
  return useStore(store, selector);
}

/** Creates the scoped store and its storage synchronization controller. */
function createConfigStore(previewConfig: Config | undefined): ConfigStore {
  let configReference = previewConfig ?? null;
  let lastPersistedConfig = previewConfig ?? null;
  let saveQueue = Promise.resolve();
  let latestRevision = 0;
  let synchronizedRevision = 0;
  const localWritesAwaitingStorageEvent = new Map<number, string>();

  const store = createStore<ConfigStoreState>()((set) => {
    const persistConfig = (nextConfig: Config) => {
      if (previewConfig !== undefined) {
        set({ saveState: "saved" });
        return;
      }

      const revision = latestRevision + 1;
      latestRevision = revision;
      const synchronizedRevisionAtSave = synchronizedRevision;
      localWritesAwaitingStorageEvent.set(revision, serializeConfig(nextConfig));
      set({ error: null, saveState: "saving" });

      const save = saveQueue.then(async () => {
        const response = await sendMessage({
          type: messageTypes.SET_CONFIG,
          payload: nextConfig,
        });
        if (!response.success) {
          throw new Error(response.error);
        }
        const hasNewerSynchronizedConfig =
          synchronizedRevisionAtSave !== synchronizedRevision;
        if (!hasNewerSynchronizedConfig) {
          lastPersistedConfig = response.data;
        }
        if (revision === latestRevision) {
          if (
            !hasNewerSynchronizedConfig &&
            !haveSameConfig(configReference, response.data)
          ) {
            configReference = response.data;
            set({ config: response.data });
          }
          set({ saveState: "saved" });
        }
        return undefined;
      });

      saveQueue = save.catch(() => undefined);
      void save.catch((caughtError: unknown) => {
        localWritesAwaitingStorageEvent.delete(revision);
        if (revision === latestRevision) {
          configReference = lastPersistedConfig;
          set({
            config: lastPersistedConfig,
            error: toErrorMessage(caughtError),
            saveState: "error",
          });
        }
      });
    };

    const updateConfig = (update: (current: Config) => Config) => {
      if (configReference === null) {
        return;
      }
      const nextConfig = configSchema.parse(update(configReference));
      configReference = nextConfig;
      set({ config: nextConfig });
      persistConfig(nextConfig);
    };

    return {
      config: previewConfig ?? null,
      error: null,
      loading: previewConfig === undefined,
      saveState: previewConfig === undefined ? "idle" : "saved",
      addFavorite: (currencyCode) => {
        updateConfig((current) => ({
          ...current,
          favorites: [...current.favorites, currencyCode],
        }));
      },
      removeFavorite: (currencyCode) => {
        updateConfig((current) => ({
          ...current,
          favorites: current.favorites.filter((favorite) => favorite !== currencyCode),
        }));
      },
      reorderFavorite: (sourceCurrency, targetCurrency, placement) => {
        updateConfig((current) => ({
          ...current,
          favorites: moveCurrencyRelative(
            current.favorites,
            sourceCurrency,
            targetCurrency,
            placement,
          ),
        }));
      },
      updateConfig,
    };
  });

  const startSynchronization = () => {
    if (previewConfig !== undefined) {
      return () => undefined;
    }

    let active = true;
    const applySynchronizedConfig = (
      nextConfig: Config,
      localRevision: number | undefined,
    ) => {
      lastPersistedConfig = nextConfig;
      store.setState({ loading: false });
      if (localRevision !== undefined && localRevision < latestRevision) {
        return;
      }
      if (!haveSameConfig(configReference, nextConfig)) {
        configReference = nextConfig;
        store.setState({ config: nextConfig });
      }
      store.setState((current) => ({
        error: null,
        saveState: current.saveState === "saving" ? current.saveState : "saved",
      }));
    };
    const handleStorageChange: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (!active || areaName !== "sync" || !Object.hasOwn(changes, CONFIG_STORAGE_KEY)) {
        return;
      }

      const candidate: unknown = changes[CONFIG_STORAGE_KEY]?.newValue;
      const parsed = parseStoredConfig(candidate);
      if (parsed === null) {
        return;
      }

      synchronizedRevision += 1;
      const serializedConfig = serializeConfig(parsed);
      const localWrite = [...localWritesAwaitingStorageEvent].find(
        ([, fingerprint]) => fingerprint === serializedConfig,
      );
      if (localWrite !== undefined) {
        localWritesAwaitingStorageEvent.delete(localWrite[0]);
      }
      applySynchronizedConfig(parsed, localWrite?.[0]);
    };
    const load = async () => {
      const initialSynchronizedRevision = synchronizedRevision;
      store.setState({ loading: true });
      try {
        const response = await sendMessage({ type: messageTypes.GET_CONFIG });
        if (!active || initialSynchronizedRevision !== synchronizedRevision) {
          return;
        }
        if (response.success) {
          configReference = response.data;
          lastPersistedConfig = response.data;
          store.setState({ config: response.data });
        } else {
          store.setState({ error: response.error });
        }
      } catch (caughtError: unknown) {
        if (active && initialSynchronizedRevision === synchronizedRevision) {
          store.setState({ error: toErrorMessage(caughtError) });
        }
      } finally {
        if (active) {
          store.setState({ loading: false });
        }
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

/** Converts an unknown persistence failure to a safe local message. */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Settings could not be saved.";
}

/** Creates the stable fingerprint used to match a storage event to a local write. */
function serializeConfig(config: Config): string {
  return JSON.stringify(config);
}

/** Avoids replacing optimistic state with an equivalent cloned response. */
function haveSameConfig(left: Config | null, right: Config): boolean {
  return left !== null && serializeConfig(left) === serializeConfig(right);
}
