import { useId } from "react";
import {
  buildSeriesPaths,
  createChartScale,
  downsampleSeries,
  type ChartValue,
} from "@/lib/chart-geometry";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 26;
const SPARKLINE_PADDING = 0.05;

interface SparklineProps {
  readonly color: string;
  readonly label: string;
  readonly onOpen: () => void;
  readonly values: readonly ChartValue[];
}

/** Shows a compact trend that opens the full rate chart. */
export function Sparkline({ color, label, onOpen, values }: SparklineProps) {
  const gradientId = `sparkline-${useId().replaceAll(/[^\w-]/gu, "")}`;
  const scale = createChartScale([values], {
    height: SPARKLINE_HEIGHT,
    padding: SPARKLINE_PADDING,
    width: SPARKLINE_WIDTH,
  });
  const paths = scale === null ? null : buildSeriesPaths(downsampleSeries(values), scale);

  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-9 w-20 shrink-0 items-center rounded-md hover:bg-accent/60",
        FOCUS_RING_CLASS_NAME,
      )}
      data-slot="sparkline"
      onClick={onOpen}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="overflow-visible"
        height={SPARKLINE_HEIGHT}
        viewBox={`0 0 ${String(SPARKLINE_WIDTH)} ${String(SPARKLINE_HEIGHT)}`}
        width={SPARKLINE_WIDTH}
      >
        {paths === null ? (
          <line
            data-slot="sparkline-placeholder"
            strokeDasharray="2 3"
            style={{ stroke: "var(--chart-baseline)" }}
            x1={0}
            x2={SPARKLINE_WIDTH}
            y1={SPARKLINE_HEIGHT / 2}
            y2={SPARKLINE_HEIGHT / 2}
          />
        ) : (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" style={{ stopColor: color, stopOpacity: 0.18 }} />
                <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path d={paths.area} fill={`url(#${gradientId})`} stroke="none" />
            <path
              d={paths.line}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              style={{ stroke: color }}
            />
          </>
        )}
      </svg>
    </button>
  );
}
