import type { Ref } from "react";
import { translate, type TranslationKey, type UiLocale } from "@/lib/i18n";
import {
  SegmentedControl,
  SegmentedControlItem,
  selectSegmentedOption,
} from "@/components/ui/segmented-control";
import { ALL_CURRENCIES_SELECTION, useRateHistoryStore } from "@/stores/rate-history";

/** The converter and the rates, which swap in place below the switch. */
export type RatesScreenView = "converter" | "rates";

const VIEWS = ["converter", "rates"] as const satisfies readonly RatesScreenView[];
const VIEW_LABEL_KEYS = {
  converter: "screenConverter",
  rates: "screenRates",
} as const satisfies Record<RatesScreenView, TranslationKey>;

interface RatesScreenSwitchProps {
  /** Receives the checked choice, so focus can move to it after a trend opens the rates. */
  readonly checkedItemRef?: Ref<HTMLButtonElement> | undefined;
  readonly locale: UiLocale;
  readonly onValueChange: (view: RatesScreenView) => void;
  readonly value: RatesScreenView;
}

/**
 * Switches between the converter and the rates. Opening the rates from here shows every
 * target, while a trend opens them with its own currency chosen.
 */
export function RatesScreenSwitch({
  checkedItemRef,
  locale,
  onValueChange,
  value,
}: RatesScreenSwitchProps) {
  const setRateSelection = useRateHistoryStore((state) => state.setSelection);
  return (
    <SegmentedControl
      aria-label={translate(locale, "screenSwitcher")}
      onValueChange={selectSegmentedOption(VIEWS, (view) => {
        if (view === "rates") {
          setRateSelection(ALL_CURRENCIES_SELECTION);
        }
        onValueChange(view);
      })}
      size="lg"
      stretch
      surface="page"
      value={value}
    >
      {VIEWS.map((view) => (
        <SegmentedControlItem
          key={view}
          ref={view === value ? checkedItemRef : undefined}
          value={view}
        >
          {translate(locale, VIEW_LABEL_KEYS[view])}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
