import { useCallback, useEffect, useRef, useState } from "react";
import { configSchema, type Config } from "../../lib/currency";
import { messageTypes, sendMessage } from "../../lib/messages";

export type ConfigSaveState = "idle" | "saving" | "saved" | "error";

const CONFIG_STORAGE_KEY = "config";

interface ConfigSettingsOptions {
  readonly previewConfig?: Config | undefined;
}

/** Loads synchronized configuration and serializes immediate saves without stale rollbacks. */
export function useConfigSettings(options: ConfigSettingsOptions = {}) {
  const { previewConfig } = options;
  const [config, setConfig] = useState<Config | null>(previewConfig ?? null);
  const [loading, setLoading] = useState(previewConfig === undefined);
  const [saveState, setSaveState] = useState<ConfigSaveState>(
    previewConfig === undefined ? "idle" : "saved",
  );
  const [error, setError] = useState<string | null>(null);
  const configReference = useRef<Config | null>(previewConfig ?? null);
  const lastPersistedConfig = useRef<Config | null>(previewConfig ?? null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestRevision = useRef(0);
  const synchronizedRevision = useRef(0);
  const localWritesAwaitingStorageEvent = useRef(new Map<number, string>());

  useEffect(() => {
    if (previewConfig !== undefined) {
      return undefined;
    }

    let active = true;
    const applySynchronizedConfig = (
      nextConfig: Config,
      localRevision: number | undefined,
    ) => {
      lastPersistedConfig.current = nextConfig;
      setLoading(false);
      if (localRevision !== undefined && localRevision < latestRevision.current) {
        return;
      }
      configReference.current = nextConfig;
      setConfig(nextConfig);
      setError(null);
      setSaveState((current) => (current === "saving" ? current : "saved"));
    };
    const handleStorageChange: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (!active || areaName !== "sync" || !Object.hasOwn(changes, CONFIG_STORAGE_KEY)) {
        return;
      }

      const candidate: unknown = changes[CONFIG_STORAGE_KEY]?.newValue;
      const parsed = configSchema.safeParse(candidate);
      if (!parsed.success) {
        return;
      }

      synchronizedRevision.current += 1;
      const serializedConfig = serializeConfig(parsed.data);
      const localWrite = [...localWritesAwaitingStorageEvent.current].find(
        ([, fingerprint]) => fingerprint === serializedConfig,
      );
      if (localWrite !== undefined) {
        localWritesAwaitingStorageEvent.current.delete(localWrite[0]);
      }
      applySynchronizedConfig(parsed.data, localWrite?.[0]);
    };
    const load = async () => {
      const initialSynchronizedRevision = synchronizedRevision.current;
      setLoading(true);
      try {
        const response = await sendMessage({ type: messageTypes.GET_CONFIG });
        if (!active || initialSynchronizedRevision !== synchronizedRevision.current) {
          return;
        }
        if (response.success) {
          configReference.current = response.data;
          lastPersistedConfig.current = response.data;
          setConfig(response.data);
        } else {
          setError(response.error);
        }
      } catch (caughtError: unknown) {
        if (active && initialSynchronizedRevision === synchronizedRevision.current) {
          setError(toErrorMessage(caughtError));
        }
      } finally {
        if (active) {
          setLoading(false);
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
  }, [previewConfig]);

  const persistConfig = useCallback(
    (nextConfig: Config) => {
      if (previewConfig !== undefined) {
        setSaveState("saved");
        return;
      }

      const revision = latestRevision.current + 1;
      latestRevision.current = revision;
      const synchronizedRevisionAtSave = synchronizedRevision.current;
      localWritesAwaitingStorageEvent.current.set(revision, serializeConfig(nextConfig));
      setSaveState("saving");
      setError(null);

      const save = saveQueue.current.then(async () => {
        const response = await sendMessage({
          type: messageTypes.SET_CONFIG,
          payload: nextConfig,
        });
        if (!response.success) {
          throw new Error(response.error);
        }
        const hasNewerSynchronizedConfig =
          synchronizedRevisionAtSave !== synchronizedRevision.current;
        if (!hasNewerSynchronizedConfig) {
          lastPersistedConfig.current = response.data;
        }
        if (revision === latestRevision.current) {
          if (!hasNewerSynchronizedConfig) {
            configReference.current = response.data;
            setConfig(response.data);
          }
          setSaveState("saved");
        }
        return undefined;
      });

      saveQueue.current = save.catch(() => undefined);
      void save.catch((caughtError: unknown) => {
        localWritesAwaitingStorageEvent.current.delete(revision);
        if (revision === latestRevision.current) {
          configReference.current = lastPersistedConfig.current;
          setConfig(lastPersistedConfig.current);
          setError(toErrorMessage(caughtError));
          setSaveState("error");
        }
      });
    },
    [previewConfig],
  );

  const updateConfig = useCallback(
    (update: (current: Config) => Config) => {
      const current = configReference.current;
      if (current === null) {
        return;
      }
      const nextConfig = configSchema.parse(update(current));
      configReference.current = nextConfig;
      setConfig(nextConfig);
      persistConfig(nextConfig);
    },
    [persistConfig],
  );

  return { config, error, loading, saveState, updateConfig };
}

/** Converts an unknown persistence failure to a safe local message. */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Settings could not be saved.";
}

/** Creates the stable fingerprint used to match a storage event to a local write. */
function serializeConfig(config: Config): string {
  return JSON.stringify(config);
}
