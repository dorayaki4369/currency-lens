import type { CurrencyCode } from "@cl/currency";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { MAX_FAVORITE_CURRENCIES, type Config } from "@/lib/currency";
import {
  CURRENCY_CODES_BY_ISO_CODE,
  type CurrencyDropPlacement,
} from "@/lib/currency-order";
import { translate, type UiLocale } from "@/lib/i18n";
import { convertCurrencyBatch } from "@/lib/rates";
import { getRateHistorySymbols } from "@/lib/rate-history";
import { getCrossRateSeries, getRateChange, slicePeriod } from "@/lib/rate-series";
import { Sparkline } from "@/components/rates/Sparkline";
import {
  ConversionEditor,
  parseConversionSourceAmount,
} from "@/components/conversion/ConversionEditor";
import { createConversionTargetAmounts } from "@/components/conversion/conversion-target-amounts";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";
import {
  requireLoadedConfig,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import {
  type PopupRatesData,
  usePopupConversion,
} from "@/entrypoints/popup/stores/conversion";
import { useTrendPalette } from "@/entrypoints/popup/stores/chart-colors";
import {
  usePopupRateHistory,
  useRateHistory,
} from "@/entrypoints/popup/stores/rate-history";
import { useConfigStore } from "@/stores/config";

export const Route = createFileRoute("/_peer/")({
  component: ConverterRoute,
});

/** Renders the converter at the popup root route. */
function ConverterRoute() {
  const popup = usePopupApplicationContext();
  const rates = usePopupConversion((state) => state.rates);
  const sourceAmount = usePopupConversion((state) => state.sourceAmount);
  const sourceCurrency = usePopupConversion((state) => state.sourceCurrency);
  const setSourceAmount = usePopupConversion((state) => state.setSourceAmount);
  const setSourceCurrency = usePopupConversion((state) => state.setSourceCurrency);
  const addFavorite = useConfigStore((state) => state.addFavorite);
  const removeFavorite = useConfigStore((state) => state.removeFavorite);
  const reorderFavorite = useConfigStore((state) => state.reorderFavorite);

  return (
    <Converter
      config={requireLoadedConfig(popup)}
      locale={popup.locale}
      onAddFavorite={addFavorite}
      onRemoveFavorite={removeFavorite}
      onReorderFavorite={reorderFavorite}
      onSourceAmountChange={setSourceAmount}
      onSourceCurrencyChange={setSourceCurrency}
      rates={rates.data}
      ratesLoading={rates.status === "loading"}
      sortedCurrencyCodes={CURRENCY_CODES_BY_ISO_CODE}
      sourceAmount={sourceAmount}
      sourceCurrency={sourceCurrency}
    />
  );
}

interface ConverterProps {
  readonly config: Config;
  readonly locale: UiLocale;
  readonly onAddFavorite: (currencyCode: CurrencyCode) => void;
  readonly onRemoveFavorite: (currencyCode: CurrencyCode) => void;
  readonly onReorderFavorite: (
    sourceCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
    placement: CurrencyDropPlacement,
  ) => void;
  readonly onSourceAmountChange: (amount: string) => void;
  readonly onSourceCurrencyChange: (currencyCode: CurrencyCode) => void;
  readonly rates: PopupRatesData | null;
  readonly ratesLoading: boolean;
  readonly sortedCurrencyCodes: readonly CurrencyCode[];
  readonly sourceAmount: string;
  readonly sourceCurrency: CurrencyCode;
}

/** Renders manual conversion and target editing as one screen. */
function Converter({
  config,
  locale,
  onAddFavorite,
  onRemoveFavorite,
  onReorderFavorite,
  onSourceAmountChange,
  onSourceCurrencyChange,
  rates,
  ratesLoading,
  sortedCurrencyCodes,
  sourceAmount,
  sourceCurrency,
}: ConverterProps) {
  const parsedAmount = parseConversionSourceAmount(sourceAmount);
  const conversionResults = useMemo(() => {
    if (rates === null || parsedAmount === null) {
      return [];
    }
    return convertCurrencyBatch(
      rates,
      [{ amount: parsedAmount, currencyCode: sourceCurrency }],
      config.favorites,
    );
  }, [config.favorites, parsedAmount, rates, sourceCurrency]);
  const targetAmounts = useMemo(
    () =>
      createConversionTargetAmounts({
        currencyCodes: config.favorites,
        loading: ratesLoading,
        locale,
        results: conversionResults,
        sourceIsValid: parsedAmount !== null,
      }),
    [config.favorites, conversionResults, locale, parsedAmount, ratesLoading],
  );

  const renderTargetTrend = useCallback(
    (currencyCode: CurrencyCode) => (
      <TargetTrend currencyCode={currencyCode} favorites={config.favorites} />
    ),
    [config.favorites],
  );

  return (
    <ConversionEditor
      amountText={sourceAmount}
      currencyCode={sourceCurrency}
      currencyCodes={sortedCurrencyCodes}
      locale={locale}
      onAmountTextChange={onSourceAmountChange}
      onCurrencyChange={onSourceCurrencyChange}
      onReorderTarget={onReorderFavorite}
      renderTargetTrend={renderTargetTrend}
      targetAmounts={targetAmounts}
      targetCurrencies={config.favorites}
      targetEditing={{
        availableCurrencyCodes: sortedCurrencyCodes,
        maximum: MAX_FAVORITE_CURRENCIES,
        onAdd: onAddFavorite,
        onRemove: onRemoveFavorite,
      }}
      targetFooter={
        rates === null ? undefined : (
          <RateTimestamp
            isStale={rates.isStale}
            locale={locale}
            sourceTimestamp={rates.sourceTimestamp}
          />
        )
      }
      targetTitle={translate(locale, "targetsHeading")}
    />
  );
}

interface TargetTrendProps {
  readonly currencyCode: CurrencyCode;
  readonly favorites: readonly CurrencyCode[];
}

/**
 * Leaves an empty cell for a target that equals the source: its rate is always 1, and
 * the rates screen does not list the base.
 */
function TargetTrend(props: TargetTrendProps) {
  const sourceCurrency = usePopupConversion((state) => state.sourceCurrency);
  return props.currencyCode === sourceCurrency ? (
    <span aria-hidden="true" className="w-20 shrink-0" data-slot="sparkline-spacer" />
  ) : (
    <TargetSparkline {...props} sourceCurrency={sourceCurrency} />
  );
}

/** Draws the past month of one target against the source and opens its rate chart. */
function TargetSparkline({
  currencyCode,
  favorites,
  sourceCurrency,
}: TargetTrendProps & { readonly sourceCurrency: CurrencyCode }) {
  const popup = usePopupApplicationContext();
  const palette = useTrendPalette();
  const setRateSelection = usePopupRateHistory((state) => state.setSelection);
  const navigate = useNavigate();
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
      color={palette[direction].line}
      label={translate(popup.locale, "openRates", { currency: currencyCode })}
      onOpen={() => {
        setRateSelection(currencyCode);
        // The rates screen is a peer of the converter, so it swaps in without a slide.
        void navigate({ to: "/rates" });
      }}
      values={series.map((point) => point.value)}
    />
  );
}
