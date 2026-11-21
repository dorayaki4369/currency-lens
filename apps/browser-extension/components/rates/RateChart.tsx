import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  buildSeriesPaths,
  createChartScale,
  findEmptySlotRanges,
  findNearestSlot,
  getEmptyRangeBounds,
  layoutAxis,
  type AxisLayout,
  type ChartScale,
  type ChartValue,
} from "@/lib/chart-geometry";
import { translate, type UiLocale } from "@/lib/i18n";
import {
  formatChartTick,
  formatChartTime,
  formatRate,
  formatSignedPercent,
  getRateFractionDigits,
} from "@/lib/rate-format";
import { getPeriodResolution, type RatePeriod, type RateSeries } from "@/lib/rate-series";
import type { ChartColor } from "@/lib/trend-colors";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

export interface RateChartSeries {
  readonly code: string;
  readonly color: ChartColor;
  /** Values on the vertical axis: rates, or percentage changes in percent mode. */
  readonly points: RateSeries;
  /** Real rates shown beside percentage changes in the hover card. */
  readonly rates?: RateSeries | undefined;
}

type RateChartMode = "percent" | "rate";

interface RateChartProps {
  readonly area: boolean;
  readonly label: string;
  readonly locale: UiLocale;
  readonly mode: RateChartMode;
  readonly period: RatePeriod;
  readonly series: readonly RateChartSeries[];
}

interface CursorRow {
  readonly code: string;
  readonly color: string;
  readonly main: string;
  readonly sub: string | null;
  readonly y: number | null;
}

interface CursorDetails {
  readonly rows: readonly CursorRow[];
  readonly time: string;
  readonly x: number;
}

interface ChartModel {
  readonly axis: AxisLayout;
  readonly describe: (index: number) => CursorDetails;
  readonly emptyRanges: readonly { readonly left: number; readonly width: number }[];
  readonly scale: ChartScale;
  readonly slotCount: number;
  readonly tickLabels: readonly string[];
  readonly valueLists: readonly (readonly ChartValue[])[];
  readonly zeroY: number | null;
}

export const RATE_CHART_HEIGHT = 124;
const DEFAULT_PLOT_WIDTH = 280;
const VALUE_PADDING = 0.12;
const PERCENT_TICK_DIGITS = 1;
const GRID_INTERVALS = [0, 1, 2] as const;
// Keeps the "no data" label only where it fits between the dashed borders.
const MIN_LABELLED_GAP_WIDTH = 44;
const TOOLTIP_OFFSET = 10;
const DOT_RADIUS = 5;
// Page keys jump about a tenth of the period, at least one slot.
const PAGE_STEP_RATIO = 0.1;

/** Draws rate history with a right-hand axis, gap markers, and a pointer/keyboard cursor. */
export function RateChart({ area, label, locale, mode, period, series }: RateChartProps) {
  const plotReference = useRef<HTMLDivElement>(null);
  const width = useElementWidth(plotReference, DEFAULT_PLOT_WIDTH);
  const gradientId = `rate-area-${useId().replaceAll(/[^\w-]/gu, "")}`;
  const [cursor, setCursor] = useState<number | null>(null);
  const model = createChartModel({ locale, mode, period, series, width });
  if (model === null) {
    return null;
  }

  const lastCursor = model.slotCount - 1;
  const cursorIndex = cursor === null ? null : Math.min(cursor, lastCursor);
  const current = model.describe(cursorIndex ?? lastCursor);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = getKeyboardCursor(event.key, cursorIndex ?? lastCursor, lastCursor);
    if (next !== null) {
      event.preventDefault();
      setCursor(next);
    }
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setCursor(findNearestSlot(model.scale, event.clientX - bounds.left));
  };

  return (
    <div className="flex flex-col gap-2" data-slot="rate-chart">
      <div className="flex">
        <div
          aria-label={label}
          aria-valuemax={lastCursor}
          aria-valuemin={0}
          aria-valuenow={cursorIndex ?? lastCursor}
          aria-valuetext={describeForScreenReader(current)}
          className={cn(
            "relative h-31 min-w-0 flex-1 cursor-crosshair rounded-xs",
            FOCUS_RING_CLASS_NAME,
            "focus-visible:ring-offset-4 focus-visible:ring-offset-card",
          )}
          data-slot="rate-chart-plot"
          onBlur={() => setCursor(null)}
          onFocus={() => setCursor((previous) => previous ?? lastCursor)}
          onKeyDown={handleKeyDown}
          onPointerLeave={() => setCursor(null)}
          onPointerMove={handlePointerMove}
          ref={plotReference}
          role="slider"
          tabIndex={0}
        >
          <ChartGrid
            emptyRanges={model.emptyRanges}
            noDataLabel={translate(locale, "rateHistoryNoData")}
            zeroY={model.zeroY}
          />
          <svg
            aria-hidden="true"
            className="absolute inset-0 overflow-visible"
            height={RATE_CHART_HEIGHT}
            viewBox={`0 0 ${String(width)} ${String(RATE_CHART_HEIGHT)}`}
            width={width}
          >
            {area ? <AreaGradient color={series[0]!.color.line} id={gradientId} /> : null}
            {model.valueLists.map((values, index) => (
              <SeriesPath
                areaFill={area && index === 0 ? `url(#${gradientId})` : null}
                color={series[index]!.color.line}
                values={values}
                key={series[index]!.code}
                scale={model.scale}
              />
            ))}
          </svg>
          {cursorIndex === null ? null : <ChartCursor details={current} width={width} />}
        </div>
        <AxisLabels axis={model.axis} />
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between text-[0.6875rem] text-muted-foreground tabular-nums"
        data-slot="rate-chart-x-axis"
        style={{ width }}
      >
        {model.tickLabels.map((tickLabel, index) => (
          // Start, middle, and end labels keep their positions while mounted.
          <span key={index}>{tickLabel}</span>
        ))}
      </div>
    </div>
  );
}

/** Derives every drawn coordinate and label; returns null when nothing can be drawn. */
function createChartModel({
  locale,
  mode,
  period,
  series,
  width,
}: {
  readonly locale: UiLocale;
  readonly mode: RateChartMode;
  readonly period: RatePeriod;
  readonly series: readonly RateChartSeries[];
  readonly width: number;
}): ChartModel | null {
  const valueLists = series.map((item) => item.points.map((point) => point.value));
  const scale = createChartScale(valueLists, {
    height: RATE_CHART_HEIGHT,
    padding: VALUE_PADDING,
    width,
  });
  if (scale === null) {
    return null;
  }

  const times = series[0]!.points.map((point) => point.time);
  const formatValue = createValueFormatter(mode, locale);
  const axisDigits =
    mode === "percent" ? PERCENT_TICK_DIGITS : getRateFractionDigits(scale.max);
  const noDataLabel = translate(locale, "rateHistoryNoData");
  const resolution = getPeriodResolution(period);

  return {
    axis: layoutAxis(
      scale,
      series.flatMap((item) => {
        const latest = item.points.findLast((point) => point.value !== null)?.value ?? null;
        return latest === null
          ? []
          : [
              {
                color: item.color.tag,
                // Percent tags keep two decimals; rate tags match the tick precision.
                text: formatValue(latest, mode === "percent" ? undefined : axisDigits),
                value: latest,
              },
            ];
      }),
      (value) => formatValue(value, axisDigits),
    ),
    describe: (index) => {
      return {
        rows: series.map((item, seriesIndex) => {
          const value = valueLists[seriesIndex]![index] ?? null;
          const rate = item.rates?.[index]?.value ?? null;
          return {
            code: item.code,
            color: item.color.line,
            main: value === null ? noDataLabel : formatValue(value),
            sub: rate === null ? null : formatRate(rate, locale),
            y: value === null ? null : scale.y(value),
          };
        }),
        time: formatChartTime(times[index]!, resolution, locale),
        x: scale.x(index),
      };
    },
    emptyRanges: findEmptySlotRanges(valueLists).map((range) =>
      getEmptyRangeBounds(range, scale),
    ),
    scale,
    slotCount: scale.slotCount,
    tickLabels: [times[0]!, times[Math.floor(times.length / 2)]!, times.at(-1)!].map(
      (time) => formatChartTick(time, period, locale),
    ),
    valueLists,
    zeroY: mode === "percent" && scale.min < 0 && scale.max > 0 ? scale.y(0) : null,
  };
}

/** Formats axis and cursor values as rates or signed percentages. */
function createValueFormatter(
  mode: RateChartMode,
  locale: UiLocale,
): (value: number, digits?: number) => string {
  return mode === "percent"
    ? (value, digits) => formatSignedPercent(value, locale, digits)
    : (value, digits) => formatRate(value, locale, digits ?? getRateFractionDigits(value));
}

/** Joins the cursor details into the slider's spoken value. */
function describeForScreenReader(details: CursorDetails): string {
  const values = details.rows.map((row) =>
    [row.code, row.main, row.sub].filter((part) => part !== null).join(" "),
  );
  return `${details.time}: ${values.join(", ")}`;
}

/** Draws the dashed grid, baseline, zero line, and no-data ranges behind the lines. */
function ChartGrid({
  emptyRanges,
  noDataLabel,
  zeroY,
}: {
  readonly emptyRanges: ChartModel["emptyRanges"];
  readonly noDataLabel: string;
  readonly zeroY: number | null;
}) {
  return (
    <div aria-hidden="true" data-slot="rate-chart-grid">
      {GRID_INTERVALS.map((step) => (
        <div
          className="absolute inset-x-0 border-t border-dashed"
          key={step}
          style={{ borderColor: "var(--chart-grid)", top: (RATE_CHART_HEIGHT * step) / 3 }}
        />
      ))}
      <div
        className="absolute inset-x-0 border-t"
        style={{ borderColor: "var(--chart-baseline)", top: RATE_CHART_HEIGHT }}
      />
      {zeroY === null ? null : (
        <div
          className="absolute inset-x-0 border-t"
          data-slot="rate-chart-zero"
          style={{ borderColor: "var(--chart-zero)", top: zeroY }}
        />
      )}
      {emptyRanges.map((range) => (
        <div
          className="absolute inset-y-0 flex items-end justify-center border-x border-dashed pb-1"
          data-slot="rate-chart-gap"
          key={range.left}
          style={{
            borderColor: "var(--chart-baseline)",
            left: range.left,
            width: range.width,
          }}
        >
          {range.width >= MIN_LABELLED_GAP_WIDTH ? (
            <span className="text-[0.6875rem] whitespace-nowrap text-muted-foreground">
              {noDataLabel}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Fades the single-currency area from the line color to transparent. */
function AreaGradient({ color, id }: { readonly color: string; readonly id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: color, stopOpacity: 0.14 }} />
        <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
      </linearGradient>
    </defs>
  );
}

/** Draws one series line, with the gradient area in single-currency mode. */
function SeriesPath({
  areaFill,
  color,
  scale,
  values,
}: {
  readonly areaFill: string | null;
  readonly color: string;
  readonly scale: ChartScale;
  readonly values: readonly ChartValue[];
}) {
  const paths = buildSeriesPaths(values, scale);
  return (
    <>
      {areaFill === null ? null : <path d={paths.area} fill={areaFill} stroke="none" />}
      <path
        d={paths.line}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        style={{ stroke: color }}
      />
    </>
  );
}

/** Shows the crosshair, a dot on each line, and the values at the cursor. */
function ChartCursor({
  details,
  width,
}: {
  readonly details: CursorDetails;
  readonly width: number;
}) {
  return (
    <div aria-hidden="true" data-slot="rate-chart-cursor">
      <div
        className="absolute top-0 h-31 border-l"
        style={{ borderColor: "var(--chart-baseline)", left: details.x }}
      />
      {details.rows.map((row) =>
        row.y === null ? null : (
          <div
            className="absolute size-2.5 rounded-full border-2 border-card"
            data-slot="rate-chart-dot"
            key={row.code}
            style={{
              backgroundColor: row.color,
              boxShadow: `0 0 0 1px ${row.color}`,
              left: details.x - DOT_RADIUS,
              top: row.y - DOT_RADIUS,
            }}
          />
        ),
      )}
      <div
        className="pointer-events-none absolute top-0 z-10 flex min-w-32 flex-col gap-0.5 rounded-lg border bg-popover px-2 py-1.5 text-[0.6875rem] text-popover-foreground shadow-md"
        data-slot="rate-chart-tooltip"
        style={
          details.x > width / 2
            ? { right: width - details.x + TOOLTIP_OFFSET }
            : { left: details.x + TOOLTIP_OFFSET }
        }
      >
        <span className="text-muted-foreground">{details.time}</span>
        {details.rows.map((row) => (
          <span className="flex items-center gap-1.5 tabular-nums" key={row.code}>
            <span
              className="size-2 shrink-0 rounded-xs"
              style={{ backgroundColor: row.color }}
            />
            <span className="flex-1 text-muted-foreground">{row.code}</span>
            <span className="font-semibold whitespace-nowrap">{row.main}</span>
            {row.sub === null ? null : (
              <span className="whitespace-nowrap text-muted-foreground">{row.sub}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Renders tick labels and latest-value tags; hidden copies size the column to fit. */
function AxisLabels({ axis }: { readonly axis: AxisLayout }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-31 min-w-14 shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums"
      data-slot="rate-chart-y-axis"
    >
      <div className="invisible flex h-0 flex-col overflow-hidden pr-1 pl-2 font-semibold">
        {[...axis.ticks, ...axis.tags].map((item) => (
          <span className="whitespace-nowrap" key={`${item.text}-${String(item.top)}`}>
            {item.text}
          </span>
        ))}
      </div>
      {axis.ticks.map((tick) => (
        <span
          className="absolute left-1.5 leading-3.5 whitespace-nowrap"
          key={tick.top}
          style={{ top: tick.top }}
        >
          {tick.text}
        </span>
      ))}
      {axis.tags.map((tag) => (
        <span
          className="absolute left-0.5 flex h-4.5 items-center rounded-[0.1875rem] px-1 font-semibold whitespace-nowrap text-white"
          data-slot="rate-chart-tag"
          key={`${tag.text}-${String(tag.top)}`}
          style={{ backgroundColor: tag.color, top: tag.top }}
        >
          {tag.text}
        </span>
      ))}
    </div>
  );
}

/** Tracks an element's width so the SVG can use real pixels. */
function useElementWidth(
  reference: RefObject<HTMLElement | null>,
  fallback: number,
): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const element = reference.current;
    if (element === null) {
      return undefined;
    }
    const update = () => setWidth(element.clientWidth || fallback);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback, reference]);
  return width;
}

/** Maps slider keys to a new cursor position, or null for unrelated keys. */
function getKeyboardCursor(key: string, current: number, last: number): number | null {
  if (key === "ArrowLeft" || key === "ArrowDown") {
    return Math.max(0, current - 1);
  }
  if (key === "ArrowRight" || key === "ArrowUp") {
    return Math.min(last, current + 1);
  }
  const pageStep = Math.max(1, Math.round((last + 1) * PAGE_STEP_RATIO));
  if (key === "PageDown") {
    return Math.max(0, current - pageStep);
  }
  if (key === "PageUp") {
    return Math.min(last, current + pageStep);
  }
  if (key === "Home") {
    return 0;
  }
  return key === "End" ? last : null;
}
