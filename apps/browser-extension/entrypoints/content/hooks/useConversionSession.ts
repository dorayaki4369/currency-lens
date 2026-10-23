import { useCallback, useReducer } from "react";
import type { DetectedCurrency } from "@/lib/currency-detection";

export interface ConversionSession {
  readonly activeDetection: DetectedCurrency | null;
  readonly isOpen: boolean;
  readonly sourceDraftIsDirty: boolean;
  readonly sourceDraftIsValid: boolean;
  readonly open: (detection: DetectedCurrency) => void;
  readonly reset: () => void;
  readonly synchronizeDetection: (detection: DetectedCurrency) => void;
  readonly updateSource: (source: DetectedCurrency | null) => void;
}

type ConversionSessionState =
  | { readonly status: "closed" }
  | {
      readonly detection: DetectedCurrency;
      readonly draftStatus: "invalid" | "pristine" | "valid";
      readonly status: "open";
    };

type ConversionSessionAction =
  | { readonly detection: DetectedCurrency; readonly type: "open" }
  | { readonly type: "reset" }
  | { readonly detection: DetectedCurrency; readonly type: "synchronize" }
  | { readonly source: DetectedCurrency | null; readonly type: "update-source" };

const CLOSED_SESSION: ConversionSessionState = { status: "closed" };

/** Owns the transient conversion interaction for one mounted content-script root. */
export function useConversionSession(): ConversionSession {
  const [state, dispatch] = useReducer(reduceConversionSession, CLOSED_SESSION);
  const open = useCallback((detection: DetectedCurrency) => {
    dispatch({ detection, type: "open" });
  }, []);
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);
  const synchronizeDetection = useCallback((detection: DetectedCurrency) => {
    dispatch({ detection, type: "synchronize" });
  }, []);
  const updateSource = useCallback((source: DetectedCurrency | null) => {
    dispatch({ source, type: "update-source" });
  }, []);

  return {
    activeDetection: state.status === "open" ? state.detection : null,
    isOpen: state.status === "open",
    sourceDraftIsDirty: state.status === "open" && state.draftStatus !== "pristine",
    sourceDraftIsValid: state.status !== "open" || state.draftStatus !== "invalid",
    open,
    reset,
    synchronizeDetection,
    updateSource,
  };
}

/** Applies valid transitions for one content-script conversion session. */
function reduceConversionSession(
  state: ConversionSessionState,
  action: ConversionSessionAction,
): ConversionSessionState {
  if (action.type === "open") {
    return {
      detection: action.detection,
      draftStatus: "pristine",
      status: "open",
    };
  }
  if (action.type === "reset") {
    return CLOSED_SESSION;
  }
  if (action.type === "synchronize") {
    if (
      state.status === "closed" ||
      state.draftStatus !== "pristine" ||
      haveSameDetection(state.detection, action.detection)
    ) {
      return state;
    }
    return { ...state, detection: action.detection };
  }
  if (state.status === "closed") {
    return state;
  }
  return action.source === null
    ? { ...state, draftStatus: "invalid" }
    : { detection: action.source, draftStatus: "valid", status: "open" };
}

/** Keeps equivalent parser results from restarting an in-flight conversion. */
function haveSameDetection(left: DetectedCurrency, right: DetectedCurrency): boolean {
  return (
    left.amount === right.amount &&
    left.currencyCode === right.currencyCode &&
    left.index === right.index &&
    left.originalText === right.originalText
  );
}
