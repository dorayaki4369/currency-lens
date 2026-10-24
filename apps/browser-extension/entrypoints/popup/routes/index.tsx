import type { CurrencyCode } from "@cl/currency";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { MAX_FAVORITE_CURRENCIES, type Config } from "@/lib/currency";
import {
  CURRENCY_CODES_BY_ISO_CODE,
  type CurrencyDropPlacement,
} from "@/lib/currency-order";
import { translate, type UiLocale } from "@/lib/i18n";
import { convertCurrencyBatch } from "@/lib/rates";
import {
  ConversionEditor,
  parseConversionSourceAmount,
} from "@/components/conversion/ConversionEditor";
import { createConversionTargetAmounts } from "@/components/conversion/conversion-target-amounts";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import {
  type PopupRatesData,
  usePopupConversion,
} from "@/entrypoints/popup/stores/conversion";
import { useConfigStore } from "@/stores/config";

export const Route = createFileRoute("/")({
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
    <PopupRouteFrame screen="converter">
      {popup.config === null ? null : (
        <Converter
          config={popup.config}
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
      )}
    </PopupRouteFrame>
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

  return (
    <ConversionEditor
      amountText={sourceAmount}
      currencyCode={sourceCurrency}
      currencyCodes={sortedCurrencyCodes}
      locale={locale}
      onAmountTextChange={onSourceAmountChange}
      onCurrencyChange={onSourceCurrencyChange}
      onReorderTarget={onReorderFavorite}
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
