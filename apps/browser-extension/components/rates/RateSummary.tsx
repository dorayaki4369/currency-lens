import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { translate, type UiLocale } from "@/lib/i18n";
import {
  formatRate,
  formatSignedPercent,
  formatSignedRate,
  getRateFractionDigits,
} from "@/lib/rate-format";
import type { RateChange, TrendDirection } from "@/lib/rate-series";
import type { ChartColor, TrendPalette } from "@/lib/trend-colors";

interface RateSummaryProps {
  readonly baseCurrency: string;
  readonly change: RateChange;
  readonly currencyCode: string;
  /** The date the change is measured from when the period starts without history. */
  readonly sinceLabel: string | null;
  readonly locale: UiLocale;
  readonly palette: TrendPalette;
}

const TREND_ARROWS = { down: ArrowDown, flat: ArrowRight, up: ArrowUp } as const;

/**
 * States the latest cross rate and how far it moved over the period. The numbers roll as the
 * period, selection, or base changes, like converted amounts do.
 */
export function RateSummary({
  baseCurrency,
  change,
  currencyCode,
  locale,
  palette,
  sinceLabel,
}: RateSummaryProps) {
  const digits = getRateFractionDigits(change.last.value);
  return (
    <div className="flex flex-col gap-0.5 tabular-nums" data-slot="rate-summary">
      <p className="leading-tight">
        <span className="text-sm text-muted-foreground">1 {baseCurrency} =</span>{" "}
        <AnimatedNumber
          className="text-[1.75rem] font-bold tracking-tight"
          text={formatRate(change.last.value, locale, digits)}
          value={change.last.value}
        />{" "}
        <span className="text-sm font-semibold text-muted-foreground">{currencyCode}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        <TrendArrow direction={change.direction} palette={palette} />{" "}
        <span className="font-semibold text-foreground">
          <AnimatedNumber
            text={formatSignedRate(change.difference, locale, digits)}
            value={change.difference}
          />{" "}
          (
          <AnimatedNumber
            text={formatSignedPercent(change.percent, locale)}
            value={change.percent}
          />
          )
        </span>
        {sinceLabel === null ? null : ` ${sinceLabel}`}
      </p>
    </div>
  );
}

export interface RateLegendItem {
  readonly change: RateChange | null;
  readonly color: ChartColor;
  readonly currencyCode: string;
  /** Shown under the change when it is measured from a later date than the period start. */
  readonly sinceLabel: string | null;
}

interface RateChangeLegendProps {
  readonly caption: string;
  readonly items: readonly RateLegendItem[];
  readonly locale: UiLocale;
  readonly palette: TrendPalette;
}

const MIN_LEGEND_COLUMNS = 3;

/** Names each overlaid line with its color and its change over the period. */
export function RateChangeLegend({
  caption,
  items,
  locale,
  palette,
}: RateChangeLegendProps) {
  return (
    <div className="flex flex-col gap-1.5" data-slot="rate-legend">
      <p className="text-xs text-muted-foreground">{caption}</p>
      <ul
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${String(Math.max(MIN_LEGEND_COLUMNS, items.length))}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <li className="flex min-w-0 flex-col gap-0.5" key={item.currencyCode}>
            <span className="flex items-center gap-1 text-xs font-semibold">
              <span
                aria-hidden="true"
                className="h-0.75 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color.line }}
              />
              {item.currencyCode}
            </span>
            {item.change === null ? (
              <span className="text-xs text-muted-foreground">
                {translate(locale, "rateHistoryNoData")}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[0.9375rem] font-bold whitespace-nowrap tabular-nums">
                <TrendArrow direction={item.change.direction} palette={palette} />
                <AnimatedNumber
                  text={formatSignedPercent(item.change.percent, locale)}
                  value={item.change.percent}
                />
              </span>
            )}
            {item.sinceLabel === null ? null : (
              <span className="truncate text-[0.6875rem] text-muted-foreground">
                {item.sinceLabel}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Shows the direction in the trend color as an icon only, so a light user-chosen color
 * never carries text that must stay readable.
 */
function TrendArrow({
  direction,
  palette,
}: {
  readonly direction: TrendDirection;
  readonly palette: TrendPalette;
}) {
  const Arrow = TREND_ARROWS[direction];
  return (
    <Arrow
      aria-hidden="true"
      className="inline size-3.5 shrink-0 align-[-0.15em]"
      data-direction={direction}
      data-slot="trend-arrow"
      strokeWidth={3}
      style={{ color: palette[direction].accent }}
    />
  );
}
