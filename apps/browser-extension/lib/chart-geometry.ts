export type ChartValue = number | null;

export interface DisplayPoint {
  /** Position on the original slot axis; averaged buckets sit between slots. */
  readonly index: number;
  readonly value: ChartValue;
}

export interface ChartScale {
  readonly height: number;
  readonly max: number;
  readonly min: number;
  readonly slotCount: number;
  readonly width: number;
  readonly x: (index: number) => number;
  readonly y: (value: number) => number;
}

export interface ChartPaths {
  readonly area: string;
  readonly line: string;
}

export interface SlotRange {
  readonly end: number;
  readonly start: number;
}

export interface AxisTagInput {
  readonly color: string;
  readonly text: string;
  readonly value: number;
}

export interface PlacedAxisTag {
  readonly color: string;
  readonly text: string;
  readonly top: number;
}

export interface AxisTick {
  readonly text: string;
  readonly top: number;
}

export interface AxisLayout {
  readonly tags: readonly PlacedAxisTag[];
  readonly ticks: readonly AxisTick[];
}

interface ChartSize {
  readonly height: number;
  /** Share of the value range added above and below the data. */
  readonly padding: number;
  readonly width: number;
}

export const DEFAULT_BUCKET_COUNT = 40;
export const AXIS_TAG_HEIGHT = 18;
export const AXIS_TICK_LINE_HEIGHT = 14;
const AXIS_TAG_SPACING = AXIS_TAG_HEIGHT + 1;
const AXIS_TICK_INTERVALS = 3;
// A tick is hidden when its centre is this close to a tag centre.
const AXIS_TICK_CLEARANCE = 16;

/** Draws a monotone cubic curve through the points, like Recharts' "monotone" line. */
export function buildMonotoneCurve(points: readonly (readonly [number, number])[]): string {
  const [firstPoint] = points;
  if (firstPoint === undefined) {
    return "";
  }
  if (points.length === 1) {
    // A zero-length segment lets round line caps show an isolated value.
    return `M${formatCoordinate(firstPoint[0])} ${formatCoordinate(firstPoint[1])} l0 0`;
  }

  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index]!;
    return (point[1] - previous[1]) / (point[0] - previous[0]);
  });
  const widths = points.slice(1).map((point, index) => point[0] - points[index]![0]);
  const tangents = points.map((_, index) => {
    if (index === 0) {
      return slopes[0]!;
    }
    if (index === points.length - 1) {
      return slopes[index - 1]!;
    }
    const before = slopes[index - 1]!;
    const after = slopes[index]!;
    if (before * after <= 0) {
      return 0;
    }
    const widthBefore = widths[index - 1]!;
    const widthAfter = widths[index]!;
    return (
      (3 * (widthBefore + widthAfter)) /
      ((2 * widthAfter + widthBefore) / before + (widthAfter + 2 * widthBefore) / after)
    );
  });

  let path = `M${formatCoordinate(firstPoint[0])} ${formatCoordinate(firstPoint[1])}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[index]!;
    const [x1, y1] = points[index + 1]!;
    const handle = widths[index]! / 3;
    path += ` C${formatCoordinate(x0 + handle)} ${formatCoordinate(y0 + tangents[index]! * handle)} ${formatCoordinate(x1 - handle)} ${formatCoordinate(y1 - tangents[index + 1]! * handle)} ${formatCoordinate(x1)} ${formatCoordinate(y1)}`;
  }
  return path;
}

/**
 * Averages long series into about `bucketCount` buckets so the curve stays smooth.
 * A bucket that touches an empty slot stays empty, and the latest slot is kept as is.
 */
export function downsampleSeries(
  values: readonly ChartValue[],
  bucketCount: number = DEFAULT_BUCKET_COUNT,
): DisplayPoint[] {
  const slotCount = values.length;
  if (slotCount === 0) {
    return [];
  }
  const size = Math.max(1, Math.ceil(slotCount / bucketCount));
  const points: DisplayPoint[] = [];
  for (let start = 0; start < slotCount; start += size) {
    const bucket = values.slice(start, start + size);
    const filled = bucket.filter((value) => value !== null);
    points.push({
      index: start === 0 ? 0 : Math.min(slotCount - 1, start + (bucket.length - 1) / 2),
      value:
        filled.length === bucket.length
          ? filled.reduce((sum, value) => sum + value, 0) / bucket.length
          : null,
    });
  }
  points[points.length - 1] = { index: slotCount - 1, value: values[slotCount - 1]! };
  return points;
}

/** Fits every series into one vertical range; returns null when nothing can be drawn. */
export function createChartScale(
  seriesList: readonly (readonly ChartValue[])[],
  size: ChartSize,
): ChartScale | null {
  const values = seriesList.flat().filter((value) => value !== null);
  if (values.length === 0) {
    return null;
  }
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const pad = (dataMax - dataMin) * size.padding || Math.abs(dataMax) * 0.001 || 1;
  const min = dataMin - pad;
  const max = dataMax + pad;
  const slotCount = Math.max(...seriesList.map((series) => series.length));
  return {
    height: size.height,
    max,
    min,
    slotCount,
    width: size.width,
    x: (index) => (slotCount <= 1 ? size.width : (index / (slotCount - 1)) * size.width),
    y: (value) => ((max - value) / (max - min)) * size.height,
  };
}

/** Builds line and area paths, breaking both wherever a point is empty. */
export function buildSeriesPaths(
  points: readonly DisplayPoint[],
  scale: ChartScale,
): ChartPaths {
  const lines: string[] = [];
  const areas: string[] = [];
  let segment: [number, number][] = [];
  const flush = () => {
    const first = segment[0];
    const last = segment.at(-1);
    if (first !== undefined && last !== undefined) {
      const curve = buildMonotoneCurve(segment);
      const bottom = formatCoordinate(scale.height);
      lines.push(curve);
      areas.push(
        `${curve} L${formatCoordinate(last[0])} ${bottom} L${formatCoordinate(first[0])} ${bottom} Z`,
      );
    }
    segment = [];
  };
  for (const point of points) {
    if (point.value === null) {
      flush();
    } else {
      segment.push([scale.x(point.index), scale.y(point.value)]);
    }
  }
  flush();
  return { area: areas.join(" "), line: lines.join(" ") };
}

/** Finds runs of slots where no series has a value. */
export function findEmptySlotRanges(
  seriesList: readonly (readonly ChartValue[])[],
): SlotRange[] {
  const slotCount = Math.max(0, ...seriesList.map((series) => series.length));
  const ranges: SlotRange[] = [];
  let start: number | null = null;
  for (let index = 0; index <= slotCount; index += 1) {
    const empty =
      index < slotCount && seriesList.every((series) => (series[index] ?? null) === null);
    if (empty && start === null) {
      start = index;
    } else if (!empty && start !== null) {
      ranges.push({ end: index - 1, start });
      start = null;
    }
  }
  return ranges;
}

/** Widens an empty run to the neighbouring slots that still have values. */
export function getEmptyRangeBounds(
  range: SlotRange,
  scale: ChartScale,
): { readonly left: number; readonly width: number } {
  const left = scale.x(Math.max(range.start - 1, 0));
  const right = scale.x(Math.min(range.end + 1, scale.slotCount - 1));
  return { left, width: right - left };
}

/**
 * Places latest-value tags on the right axis without overlap, then hides tick labels
 * that would collide with a tag, as TradingView does.
 */
export function layoutAxis(
  scale: ChartScale,
  tags: readonly AxisTagInput[],
  formatTick: (value: number) => string,
): AxisLayout {
  const bottomLimit = Math.max(0, scale.height - AXIS_TAG_HEIGHT);
  const sorted = tags
    .map((tag) => ({
      color: tag.color,
      text: tag.text,
      top: clamp(scale.y(tag.value) - AXIS_TAG_HEIGHT / 2, 0, bottomLimit),
    }))
    .toSorted((first, second) => first.top - second.top);

  const pushedDown: PlacedAxisTag[] = [];
  for (const tag of sorted) {
    const previous = pushedDown.at(-1);
    pushedDown.push(
      previous !== undefined && tag.top < previous.top + AXIS_TAG_SPACING
        ? { ...tag, top: previous.top + AXIS_TAG_SPACING }
        : tag,
    );
  }

  // Pull the stack back up if pushing tags down ran past the bottom edge.
  const placed: PlacedAxisTag[] = [];
  let limit = bottomLimit;
  for (const tag of pushedDown.toReversed()) {
    const top = Math.min(tag.top, limit);
    placed.unshift({ ...tag, top });
    limit = top - AXIS_TAG_SPACING;
  }

  const ticks: AxisTick[] = [];
  for (let step = 0; step <= AXIS_TICK_INTERVALS; step += 1) {
    const y = (scale.height * step) / AXIS_TICK_INTERVALS;
    const clashes = placed.some(
      (tag) => Math.abs(tag.top + AXIS_TAG_HEIGHT / 2 - y) < AXIS_TICK_CLEARANCE,
    );
    if (!clashes) {
      ticks.push({
        // Interpolating from max keeps the bottom tick exactly at min.
        text: formatTick(
          scale.max + (scale.min - scale.max) * (step / AXIS_TICK_INTERVALS),
        ),
        top: y - AXIS_TICK_LINE_HEIGHT / 2,
      });
    }
  }
  return { tags: placed, ticks };
}

/** Returns the drawn point nearest to a horizontal position. */
export function findNearestPointIndex(
  points: readonly DisplayPoint[],
  scale: ChartScale,
  x: number,
): number {
  let nearest = 0;
  points.forEach((point, index) => {
    if (
      Math.abs(scale.x(point.index) - x) < Math.abs(scale.x(points[nearest]!.index) - x)
    ) {
      nearest = index;
    }
  });
  return nearest;
}

/** Keeps a value inside an inclusive range. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Rounds SVG coordinates to keep paths compact. */
function formatCoordinate(value: number): string {
  return value.toFixed(1);
}
