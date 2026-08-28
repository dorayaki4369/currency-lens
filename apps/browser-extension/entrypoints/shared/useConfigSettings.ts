import { useCallback, useEffect, useRef, useState } from "react";
import { configSchema, type Config } from "../../lib/currency";
import { messageTypes, sendMessage } from "../../lib/messages";

export type ConfigSaveState = "idle" | "saving" | "saved" | "error";

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

  useEffect(() => {
    if (previewConfig !== undefined) {
      return undefined;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await sendMessage({ type: messageTypes.GET_CONFIG });
        if (!active) {
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
        if (active) {
          setError(toErrorMessage(caughtError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
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
        lastPersistedConfig.current = response.data;
        if (revision === latestRevision.current) {
          configReference.current = response.data;
          setConfig(response.data);
          setSaveState("saved");
        }
        return undefined;
      });

      saveQueue.current = save.catch(() => undefined);
      void save.catch((caughtError: unknown) => {
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
