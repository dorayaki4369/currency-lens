import type { CurrencyCode } from "@cl/currency";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useId, useMemo } from "react";
import type { Config } from "@/lib/currency";
import { CURRENCY_CODES_BY_ISO_CODE } from "@/lib/currency-order";
import { translate, type TranslationKey, type UiLocale } from "@/lib/i18n";
import { formatChangeStart } from "@/lib/rate-format";
import { getRateHistorySymbols, type RateHistory } from "@/lib/rate-history";
import {
  getCrossRateSeries,
  getPeriodResolution,
  getRateChange,
  hasRateValues,
  RATE_PERIODS,
  slicePeriod,
  toPercentChangeSeries,
  type RateChange,
  type RatePeriod,
} from "@/lib/rate-series";
import {
  getRateSeriesColor,
  getTrendColor,
  getTrendColorScheme,
  type TrendColorScheme,
} from "@/lib/trend-colors";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { RateChart, type RateChartSeries } from "@/components/rates/RateChart";
import { RateChangeLegend, RateSummary } from "@/components/rates/RateSummary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import {
  type PopupRatesData,
  usePopupConversion,
} from "@/entrypoints/popup/stores/conversion";
import {
  type RateChartSelection,
  type RateHistoryEntry,
  usePopupRateHistory,
  useRateHistory,
} from "@/entrypoints/popup/stores/rate-history";

export const Route = createFileRoute("/rates")({
  component: RatesRoute,
});

const PERIOD_LABEL_KEYS = {
  "1D": "period1D",
  "5D": "period5D",
  "1M": "period1M",
  "6M": "period6M",
  YTD: "periodYTD",
  "1Y": "period1Y",
} as const satisfies Record<RatePeriod, TranslationKey>;
const PERIOD_SUFFIX_KEYS = {
  "1D": "periodPast1D",
  "5D": "periodPast5D",
  "1M": "periodPast1M",
  "6M": "periodPast6M",
  YTD: "periodPastYTD",
  "1Y": "periodPast1Y",
} as const satisfies Record<RatePeriod, TranslationKey>;
const ALL_SELECTION = "ALL";

/** Renders the rate history screen beside the converter. */
function RatesRoute() {
  const popup = usePopupApplicationContext();
  const rates = usePopupConversion((state) => state.rates);
  const sourceCurrency = usePopupConversion((state) => state.sourceCurrency);
  const setSourceCurrency = usePopupConversion((state) => state.setSourceCurrency);
  const period = usePopupRateHistory((state) => state.period);
  const selection = usePopupRateHistory((state) => state.selection);
  const setPeriod = usePopupRateHistory((state) => state.setPeriod);
  const setSelection = usePopupRateHistory((state) => state.setSelection);

  return (
    <PopupRouteFrame screen="rates">
      {popup.config === null ? null : (
        <RatesScreen
          baseCurrency={sourceCurrency}
          config={popup.config}
          locale={popup.locale}
          onBaseCurrencyChange={setSourceCurrency}
          onPeriodChange={setPeriod}
          onSelectionChange={setSelection}
          period={period}
          rates={rates.data}
          selection={selection}
        />
      )}
    </PopupRouteFrame>
  );
}

interface RatesScreenProps {
  readonly baseCurrency: CurrencyCode;
  readonly config: Config;
  readonly locale: UiLocale;
  readonly onBaseCurrencyChange: (currencyCode: CurrencyCode) => void;
  readonly onPeriodChange: (period: RatePeriod) => void;
  readonly onSelectionChange: (selection: RateChartSelection) => void;
  readonly period: RatePeriod;
  readonly rates: PopupRatesData | null;
  readonly selection: RateChartSelection;
}

/** Lays out the shared base picker, the currency and period choices, and the chart. */
function RatesScreen({
  baseCurrency,
  config,
  locale,
  onBaseCurrencyChange,
  onPeriodChange,
  onSelectionChange,
  period,
  rates,
  selection,
}: RatesScreenProps) {
  const baseHeadingId = useId();
  const baseCurrencyId = useId();
  const ratesHeadingId = useId();
  const lineCurrencies = config.favorites.filter(
    (currencyCode) => currencyCode !== baseCurrency,
  );
  const activeSelection: RateChartSelection =
    selection !== ALL_SELECTION && lineCurrencies.includes(selection)
      ? selection
      : ALL_SELECTION;
  const symbols = useMemo(
    () => getRateHistorySymbols(config.favorites, baseCurrency),
    [baseCurrency, config.favorites],
  );
  const history = useRateHistory(getPeriodResolution(period), symbols);

  return (
    <Stack gap={3}>
      <Stack aria-labelledby={baseHeadingId} as="section">
        <SectionHeader id={baseHeadingId} title={translate(locale, "ratesBaseHeading")} />
        <Card className="overflow-hidden" spacing="none">
          <Label className="sr-only" htmlFor={baseCurrencyId}>
            {translate(locale, "ratesBaseHeading")}
          </Label>
          <CurrencyCombobox
            ariaLabel={translate(locale, "ratesBaseHeading")}
            currencyCodes={CURRENCY_CODES_BY_ISO_CODE}
            id={baseCurrencyId}
            locale={locale}
            onValueChange={onBaseCurrencyChange}
            placeholder={translate(locale, "targetChoose")}
            value={baseCurrency}
            variant="row"
          />
        </Card>
      </Stack>

      <Stack aria-labelledby={ratesHeadingId} as="section">
        <SectionHeader id={ratesHeadingId} title={translate(locale, "ratesHeading")} />
        <Card
          className="gap-3 rounded-2xl py-3 pr-1.5 pl-3"
          data-slot="rate-card"
          spacing="none"
        >
          {lineCurrencies.length === 0 ? (
            <p className="pr-1.5 text-sm text-muted-foreground">
              {translate(locale, "rateHistoryNoTargets", { base: baseCurrency })}
            </p>
          ) : (
            <>
              <SegmentedControl
                className="mr-1.5"
                label={translate(locale, "ratesCurrencyGroup")}
                onValueChange={onSelectionChange}
                options={[
                  { label: translate(locale, "ratesAll"), value: ALL_SELECTION },
                  ...lineCurrencies.map((currencyCode) => ({
                    label: currencyCode,
                    value: currencyCode,
                  })),
                ]}
                value={activeSelection}
                variant="compact"
              />
              <RatePanel
                baseCurrency={baseCurrency}
                history={history}
                lineCurrencies={lineCurrencies}
                locale={locale}
                onPeriodChange={onPeriodChange}
                period={period}
                selection={activeSelection}
              />
            </>
          )}
        </Card>
        {rates === null ? null : (
          <RateTimestamp
            isStale={rates.isStale}
            locale={locale}
            sourceTimestamp={rates.sourceTimestamp}
          />
        )}
      </Stack>
    </Stack>
  );
}

interface RatePanelProps {
  readonly baseCurrency: CurrencyCode;
  readonly history: RateHistoryEntry;
  readonly lineCurrencies: readonly CurrencyCode[];
  readonly locale: UiLocale;
  readonly onPeriodChange: (period: RatePeriod) => void;
  readonly period: RatePeriod;
  readonly selection: RateChartSelection;
}

/** Shows the summary, period choices, and chart, or the state that replaces the chart. */
function RatePanel({
  baseCurrency,
  history,
  lineCurrencies,
  locale,
  onPeriodChange,
  period,
  selection,
}: RatePanelProps) {
  const colorScheme = getTrendColorScheme(locale);
  const periodSelector = (
    <SegmentedControl
      className="mr-1.5"
      label={translate(locale, "ratesPeriodGroup")}
      onValueChange={onPeriodChange}
      options={RATE_PERIODS.map((value) => ({
        label: translate(locale, PERIOD_LABEL_KEYS[value]),
        value,
      }))}
      value={period}
      variant="pill"
    />
  );
  if (history.status === "loading") {
    return <RatePanelSkeleton locale={locale} periodSelector={periodSelector} />;
  }
  if (history.status === "error") {
    return (
      <>
        {periodSelector}
        <Alert className="mr-1.5" variant="destructive">
          <AlertDescription>{translate(locale, "rateHistoryError")}</AlertDescription>
        </Alert>
      </>
    );
  }

  const view = createRateView({
    baseCurrency,
    colorScheme,
    history: history.data,
    lineCurrencies,
    locale,
    period,
    selection,
  });
  return (
    <>
      {view === null ? null : view.summary}
      {periodSelector}
      {view === null ? (
        <RateHistoryEmpty locale={locale} />
      ) : (
        <RateChart
          area={view.mode === "rate"}
          label={view.label}
          locale={locale}
          mode={view.mode}
          period={period}
          series={view.series}
        />
      )}
    </>
  );
}

interface RateViewOptions {
  readonly baseCurrency: CurrencyCode;
  readonly colorScheme: TrendColorScheme;
  readonly history: RateHistory;
  readonly lineCurrencies: readonly CurrencyCode[];
  readonly locale: UiLocale;
  readonly period: RatePeriod;
  readonly selection: RateChartSelection;
}

interface RateView {
  readonly label: string;
  readonly mode: "percent" | "rate";
  readonly series: readonly RateChartSeries[];
  readonly summary: ReactNode;
}

/** Derives the chart series and the summary for the selection, or null without data. */
function createRateView({
  baseCurrency,
  colorScheme,
  history,
  lineCurrencies,
  locale,
  period,
  selection,
}: RateViewOptions): RateView | null {
  const resolution = getPeriodResolution(period);
  const periodText = translate(locale, PERIOD_SUFFIX_KEYS[period]);
  const describeStart = (change: RateChange) =>
    change.measuredFromPeriodStart
      ? null
      : translate(locale, "rateChangeSince", {
          date: formatChangeStart(change.first.time, resolution, locale),
        });
  const seriesByCurrency = lineCurrencies.map((currencyCode, index) => ({
    color: getRateSeriesColor(index),
    currencyCode,
    rates: slicePeriod(getCrossRateSeries(history, currencyCode, baseCurrency), period),
  }));

  if (selection !== ALL_SELECTION) {
    const rates = seriesByCurrency.find((item) => item.currencyCode === selection)!.rates;
    const change = getRateChange(rates);
    if (change === null) {
      return null;
    }
    const trend = getTrendColor(change.direction, colorScheme);
    return {
      label: translate(locale, "rateChartLabel", {
        base: baseCurrency,
        currency: selection,
        period: periodText,
      }),
      mode: "rate",
      series: [{ code: selection, color: trend, points: rates }],
      summary: (
        <RateSummary
          baseCurrency={baseCurrency}
          change={change}
          colorScheme={colorScheme}
          currencyCode={selection}
          locale={locale}
          periodLabel={describeStart(change) ?? periodText}
        />
      ),
    };
  }

  const drawn = seriesByCurrency.filter((item) => hasRateValues(item.rates));
  if (drawn.length === 0) {
    return null;
  }
  return {
    label: translate(locale, "rateChartPercentLabel", {
      base: baseCurrency,
      period: periodText,
    }),
    mode: "percent",
    series: drawn.map((item) => ({
      code: item.currencyCode,
      color: item.color,
      points: toPercentChangeSeries(item.rates),
      rates: item.rates,
    })),
    summary: (
      <RateChangeLegend
        caption={translate(locale, "ratesAllCaption", {
          base: baseCurrency,
          period: periodText,
        })}
        colorScheme={colorScheme}
        items={seriesByCurrency.map((item) => {
          const change = getRateChange(item.rates);
          return {
            change,
            color: item.color,
            currencyCode: item.currencyCode,
            sinceLabel: change === null ? null : describeStart(change),
          };
        })}
        locale={locale}
      />
    ),
  };
}

/** Explains that the selected range has no history yet. */
function RateHistoryEmpty({ locale }: { readonly locale: UiLocale }) {
  return (
    <p
      className="mr-1.5 flex h-31 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground"
      data-slot="rate-history-empty"
    >
      {translate(locale, "rateHistoryEmpty")}
    </p>
  );
}

/** Keeps the chart's footprint while history loads. */
function RatePanelSkeleton({
  locale,
  periodSelector,
}: {
  readonly locale: UiLocale;
  readonly periodSelector: ReactNode;
}) {
  return (
    <>
      <Stack aria-hidden="true" className="mr-1.5" gap={1.5}>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-48" />
      </Stack>
      {periodSelector}
      <div
        aria-label={translate(locale, "rateHistoryLoading")}
        className="mr-1.5"
        role="status"
      >
        <Skeleton className="h-31 w-full" />
      </div>
    </>
  );
}
