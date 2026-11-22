import type { CurrencyCode } from "@cl/currency";
import { useMemo } from "react";
import { translate, type UiLocale } from "@/lib/i18n";
import { getRateHistorySymbols } from "@/lib/rate-history";
import { getCrossRateSeries, getRateChange, slicePeriod } from "@/lib/rate-series";
import { getTrendColor } from "@/lib/trend-colors";
import { Sparkline } from "@/components/rates/Sparkline";
import { useRateHistory, useRateHistoryStore } from "@/stores/rate-history";

interface TargetTrendProps {
  readonly currencyCode: CurrencyCode;
  /** Every conversion target, which shares one history request across the rows. */
  readonly favorites: readonly CurrencyCode[];
  readonly locale: UiLocale;
  /** Shows the rates screen after the trend has chosen its currency there. */
  readonly onOpenRates: () => void;
  readonly sourceCurrency: CurrencyCode;
}

/**
 * Draws the past month of one target against the source and opens its rate chart. A target
 * that equals the source keeps an empty cell: its rate is always 1, and the rates screen
 * does not list the base.
 */
export function TargetTrend(props: TargetTrendProps) {
  return props.currencyCode === props.sourceCurrency ? (
    <span aria-hidden="true" className="w-20 shrink-0" data-slot="sparkline-spacer" />
  ) : (
    <TargetSparkline {...props} />
  );
}

/** Loads the shared daily history and draws one target's month from it. */
function TargetSparkline({
  currencyCode,
  favorites,
  locale,
  onOpenRates,
  sourceCurrency,
}: TargetTrendProps) {
  const setRateSelection = useRateHistoryStore((state) => state.setSelection);
  const symbols = useMemo(
    () => getRateHistorySymbols(favorites, sourceCurrency),
    [favorites, sourceCurrency],
  );
  const history = useRateHistory("daily", symbols);
  const series =
    history.data === null
      ? []
      : slicePeriod(
          // The sparkline draws values only, so the latest point's time does not matter.
          getCrossRateSeries(history.data, currencyCode, sourceCurrency, 0),
          "1M",
        );
  const direction = getRateChange(series)?.direction ?? "flat";

  return (
    <Sparkline
      color={getTrendColor(direction).line}
      label={translate(locale, "openRates", { currency: currencyCode })}
      onOpen={() => {
        setRateSelection(currencyCode);
        onOpenRates();
      }}
      values={series.map((point) => point.value)}
    />
  );
}
