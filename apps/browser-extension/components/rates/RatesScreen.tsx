import type { CurrencyCode } from "@cl/currency";
import { RotateCw } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
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
import { getRateSeriesColor, type TrendPalette } from "@/lib/trend-colors";
import { useHeldAmount } from "@/components/conversion/ConvertedAmount";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { RateChart, type RateChartSeries } from "@/components/rates/RateChart";
import { RateChangeLegend, RateSummary } from "@/components/rates/RateSummary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  SegmentedControl,
  SegmentedControlItem,
  selectSegmentedOption,
} from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrendPalette } from "@/stores/chart-colors";
import {
  ALL_CURRENCIES_SELECTION as ALL_SELECTION,
  type RateChartSelection,
  type RateHistoryEntry,
  useRateHistory,
  useRateHistoryStore,
} from "@/stores/rate-history";

/** When the shown rates were published, and whether they are out of date. */
export interface RatesScreenRateTime {
  readonly isStale: boolean;
  readonly sourceTimestamp: number;
}

export interface RatesScreenProps {
  readonly baseCurrency: CurrencyCode;
  /** Every conversion target; the base itself is left out of the chart. */
  readonly favorites: readonly CurrencyCode[];
  readonly headingLevel?: 2 | 3 | undefined;
  readonly locale: UiLocale;
  readonly onBaseCurrencyChange: (currencyCode: CurrencyCode) => void;
  /** Keeps the base picker's list inside the conversion card's Shadow DOM when false. */
  readonly portalled?: boolean | undefined;
  readonly rateTime: RatesScreenRateTime | null;
}

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

/**
 * Lays out the base picker, the currency and period choices, and the chart. The period and
 * the selection live in the nearest rate history provider.
 */
export function RatesScreen({
  baseCurrency,
  favorites,
  headingLevel = 2,
  locale,
  onBaseCurrencyChange,
  portalled = true,
  rateTime,
}: RatesScreenProps) {
  const baseHeadingId = useId();
  const baseCurrencyId = useId();
  const ratesHeadingId = useId();
  const period = useRateHistoryStore((state) => state.period);
  const selection = useRateHistoryStore((state) => state.selection);
  const onPeriodChange = useRateHistoryStore((state) => state.setPeriod);
  const onSelectionChange = useRateHistoryStore((state) => state.setSelection);
  const lineCurrencies = favorites.filter((currencyCode) => currencyCode !== baseCurrency);
  const activeSelection: RateChartSelection =
    selection !== ALL_SELECTION && lineCurrencies.includes(selection)
      ? selection
      : ALL_SELECTION;
  const symbols = useMemo(
    () => getRateHistorySymbols(favorites, baseCurrency),
    [baseCurrency, favorites],
  );
  const resolution = getPeriodResolution(period);
  const history = useRateHistory(resolution, symbols);
  const loadHistory = useRateHistoryStore((state) => state.loadHistory);

  return (
    <Stack gap={3}>
      <Stack aria-labelledby={baseHeadingId} as="section">
        <SectionHeader
          headingLevel={headingLevel}
          id={baseHeadingId}
          title={translate(locale, "ratesBaseHeading")}
        />
        <Card className="overflow-hidden" spacing="flush">
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
            portalled={portalled}
            value={baseCurrency}
            variant="row"
          />
        </Card>
      </Stack>

      <Stack aria-labelledby={ratesHeadingId} as="section">
        <SectionHeader
          headingLevel={headingLevel}
          id={ratesHeadingId}
          // The converter's targets header carries an edit button; match its row so the
          // heading and card stay put when switching screens.
          reserveActionHeight
          title={translate(locale, "ratesHeading")}
        />
        <Card data-slot="rate-card">
          {lineCurrencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {translate(locale, "rateHistoryNoTargets", { base: baseCurrency })}
            </p>
          ) : (
            <>
              <SegmentedControl
                aria-label={translate(locale, "ratesCurrencyGroup")}
                stretch
                onValueChange={selectSegmentedOption<RateChartSelection>(
                  [ALL_SELECTION, ...lineCurrencies],
                  onSelectionChange,
                )}
                size="sm"
                value={activeSelection}
              >
                <SegmentedControlItem
                  // The visible ALL is also the Albanian lek's code, so the name tells them apart.
                  aria-label={translate(locale, "ratesAllName")}
                  value={ALL_SELECTION}
                >
                  {translate(locale, "ratesAll")}
                </SegmentedControlItem>
                {lineCurrencies.map((currencyCode) => (
                  <SegmentedControlItem key={currencyCode} value={currencyCode}>
                    {currencyCode}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
              <RatePanel
                baseCurrency={baseCurrency}
                history={history}
                latestTime={rateTime?.sourceTimestamp ?? Date.now()}
                lineCurrencies={lineCurrencies}
                locale={locale}
                onPeriodChange={onPeriodChange}
                onRetry={() => void loadHistory(resolution, symbols)}
                period={period}
                selection={activeSelection}
              />
            </>
          )}
        </Card>
        {rateTime === null ? null : (
          <RateTimestamp
            isStale={rateTime.isStale}
            locale={locale}
            sourceTimestamp={rateTime.sourceTimestamp}
          />
        )}
      </Stack>
    </Stack>
  );
}

interface RatePanelProps {
  readonly baseCurrency: CurrencyCode;
  readonly history: RateHistoryEntry;
  /** When the newest rate was published; dates today's daily point. */
  readonly latestTime: number;
  readonly lineCurrencies: readonly CurrencyCode[];
  readonly locale: UiLocale;
  readonly onPeriodChange: (period: RatePeriod) => void;
  readonly onRetry: () => void;
  readonly period: RatePeriod;
  readonly selection: RateChartSelection;
}

/** Shows the summary, period choices, and chart, or the state that replaces the chart. */
function RatePanel({
  baseCurrency,
  history,
  latestTime,
  lineCurrencies,
  locale,
  onPeriodChange,
  onRetry,
  period,
  selection,
}: RatePanelProps) {
  const palette = useTrendPalette();
  const periodSelector = (
    <SegmentedControl
      aria-label={translate(locale, "ratesPeriodGroup")}
      onValueChange={selectSegmentedOption(RATE_PERIODS, onPeriodChange)}
      value={period}
      size="sm"
      stretch
      variant="pill"
    >
      {RATE_PERIODS.map((value) => (
        <SegmentedControlItem key={value} value={value}>
          {translate(locale, PERIOD_LABEL_KEYS[value])}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
  if (history.status === "loading") {
    return (
      <RatePanelLayout
        body={<RateChartSkeleton locale={locale} />}
        loading
        periodSelector={periodSelector}
        summary={null}
      />
    );
  }
  if (history.status === "error") {
    return (
      <RatePanelLayout
        body={
          <Alert variant="destructive">
            <AlertDescription>
              <p>{translate(locale, "rateHistoryError")}</p>
              <Button
                className="text-foreground"
                onClick={onRetry}
                size="sm"
                type="button"
                variant="outline"
              >
                <RotateCw aria-hidden="true" />
                {translate(locale, "rateHistoryRetry")}
              </Button>
            </AlertDescription>
          </Alert>
        }
        periodSelector={periodSelector}
        summary={null}
      />
    );
  }

  const view = createRateView({
    baseCurrency,
    palette,
    history: history.data,
    latestTime,
    lineCurrencies,
    locale,
    period,
    selection,
  });
  return (
    <RatePanelLayout
      body={
        view === null ? (
          <RateHistoryEmpty locale={locale} />
        ) : (
          <RateChart
            area={view.mode === "rate"}
            // A new selection starts without the previous cursor.
            key={`${baseCurrency}:${selection}:${period}`}
            label={view.label}
            locale={locale}
            mode={view.mode}
            period={period}
            series={view.series}
          />
        )
      }
      periodSelector={periodSelector}
      summary={view === null ? null : view.summary}
    />
  );
}

interface RatePanelLayoutProps {
  readonly body: ReactNode;
  /** History for the period is on its way; the last summary stays until it arrives. */
  readonly loading?: boolean | undefined;
  readonly periodSelector: ReactNode;
  readonly summary: ReactNode;
}

/**
 * Places the summary and the period choice at the same positions in every history state, so
 * React keeps their instances: the period thumb slides, and the summary's numbers roll from
 * the last shown period to the new one even when a new resolution has to load first.
 */
function RatePanelLayout({
  body,
  loading = false,
  periodSelector,
  summary,
}: RatePanelLayoutProps) {
  const heldSummary = useHeldAmount<ReactNode>(summary, loading ? "pending" : "settled");
  return (
    <>
      {heldSummary.amount ?? (loading ? <RateSummarySkeleton /> : null)}
      {periodSelector}
      {body}
    </>
  );
}

interface RateViewOptions {
  readonly baseCurrency: CurrencyCode;
  readonly palette: TrendPalette;
  readonly history: RateHistory;
  readonly latestTime: number;
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
  palette,
  history,
  latestTime,
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
    rates: slicePeriod(
      getCrossRateSeries(history, currencyCode, baseCurrency, latestTime),
      period,
    ),
  }));

  if (selection !== ALL_SELECTION) {
    const rates = seriesByCurrency.find((item) => item.currencyCode === selection)!.rates;
    const change = getRateChange(rates);
    if (change === null) {
      return null;
    }
    const trend = palette[change.direction];
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
          palette={palette}
          currencyCode={selection}
          locale={locale}
          sinceLabel={describeStart(change)}
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
        caption={translate(locale, "ratesAllCaption", { base: baseCurrency })}
        palette={palette}
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
      className="flex h-31 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground"
      data-slot="rate-history-empty"
    >
      {translate(locale, "rateHistoryEmpty")}
    </p>
  );
}

/** Keeps the summary's footprint while history loads. */
function RateSummarySkeleton() {
  return (
    <Stack aria-hidden="true" gap={1.5}>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-48" />
    </Stack>
  );
}

/** Keeps the chart's footprint while history loads. */
function RateChartSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <div aria-label={translate(locale, "rateHistoryLoading")} role="status">
      <Skeleton className="h-31 w-full" />
    </div>
  );
}
