import { describe, expect, it } from "vitest";
import {
  AXIS_TAG_HEIGHT,
  buildMonotoneCurve,
  buildSeriesPaths,
  createChartScale,
  downsampleSeries,
  findEmptySlotRanges,
  findNearestPointIndex,
  getEmptyRangeBounds,
  layoutAxis,
  type ChartScale,
} from "@/lib/chart-geometry";

const SIZE = { height: 100, padding: 0, width: 200 };

/** Formats axis values as whole numbers for readable expectations. */
function format(value: number): string {
  return String(Math.round(value));
}

/** Creates a scale that must exist for the given values. */
function requireScale(values: readonly (number | null)[][], size = SIZE): ChartScale {
  const scale = createChartScale(values, size);
  if (scale === null) {
    throw new Error("Expected a chart scale");
  }
  return scale;
}

describe("buildMonotoneCurve", () => {
  it("draws nothing without points and a round dot for a single point", () => {
    expect(buildMonotoneCurve([])).toBe("");
    expect(buildMonotoneCurve([[1, 2]])).toBe("M1.0 2.0 l0 0");
  });

  it("passes through every point with cubic segments", () => {
    expect(
      buildMonotoneCurve([
        [0, 0],
        [10, 10],
        [20, 30],
      ]),
    ).toBe("M0.0 0.0 C3.3 3.3 6.7 5.6 10.0 10.0 C13.3 14.4 16.7 23.3 20.0 30.0");
  });

  it("flattens the tangent at a turning point so the curve never overshoots", () => {
    const path = buildMonotoneCurve([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
    expect(path).toContain("6.7 10.0 10.0 10.0 C13.3 10.0");
  });
});

describe("downsampleSeries", () => {
  it("keeps short series and the exact latest value", () => {
    expect(downsampleSeries([1, null, 3])).toEqual([
      { index: 0, value: 1 },
      { index: 1, value: null },
      { index: 2, value: 3 },
    ]);
    expect(downsampleSeries([])).toEqual([]);
  });

  it("averages buckets and leaves any bucket that touches a gap empty", () => {
    const values = [1, 3, 5, null, 7, 9, 11, 13];
    expect(downsampleSeries(values, 4)).toEqual([
      { index: 0, value: 2 },
      { index: 2.5, value: null },
      { index: 4.5, value: 8 },
      { index: 7, value: 13 },
    ]);
  });

  it("uses about forty buckets for a year of days", () => {
    expect(downsampleSeries(Array.from({ length: 366 }, () => 1))).toHaveLength(37);
  });
});

describe("createChartScale", () => {
  it("fits every series into one padded range", () => {
    const scale = requireScale(
      [
        [10, 20],
        [null, 30],
      ],
      { ...SIZE, padding: 0.5 },
    );
    expect(scale.min).toBe(0);
    expect(scale.max).toBe(40);
    expect(scale.slotCount).toBe(2);
    expect(scale.x(0)).toBe(0);
    expect(scale.x(1)).toBe(200);
    expect(scale.y(40)).toBe(0);
    expect(scale.y(0)).toBe(100);
  });

  it("opens a range around flat or zero data and centres nothing without values", () => {
    const flat = requireScale([[5, 5]]);
    expect(flat.max - flat.min).toBeCloseTo(0.01);
    const zero = requireScale([[0]]);
    expect([zero.min, zero.max]).toEqual([-1, 1]);
    expect(zero.x(0)).toBe(200);
    expect(createChartScale([[null]], SIZE)).toBeNull();
    expect(createChartScale([], SIZE)).toBeNull();
  });
});

describe("buildSeriesPaths", () => {
  it("breaks the line and closes one area per run of values", () => {
    const scale = requireScale([[0, 100, null, 50, 50]]);
    const paths = buildSeriesPaths(downsampleSeries([0, 100, null, 50, 50]), scale);
    expect(paths.line.match(/M/gu)).toHaveLength(2);
    expect(paths.area.match(/Z/gu)).toHaveLength(2);
    expect(paths.area).toContain("L50.0 100.0 L0.0 100.0 Z");
  });

  it("returns empty paths when every point is empty", () => {
    const scale = requireScale([[1]]);
    expect(buildSeriesPaths([{ index: 0, value: null }], scale)).toEqual({
      area: "",
      line: "",
    });
  });
});

describe("empty slot ranges", () => {
  it("marks only slots where no series has a value", () => {
    expect(
      findEmptySlotRanges([
        [null, 1, null, null, 1, null],
        [null, null, null, 2, 2, null],
      ]),
    ).toEqual([
      { end: 0, start: 0 },
      { end: 2, start: 2 },
      { end: 5, start: 5 },
    ]);
    expect(findEmptySlotRanges([])).toEqual([]);
  });

  it("widens a range to the neighbouring values within the plot", () => {
    const scale = requireScale([[1, null, null, 1, 1]]);
    expect(getEmptyRangeBounds({ end: 2, start: 1 }, scale)).toEqual({
      left: 0,
      width: 150,
    });
    expect(getEmptyRangeBounds({ end: 4, start: 0 }, scale)).toEqual({
      left: 0,
      width: 200,
    });
  });
});

describe("layoutAxis", () => {
  const scale = requireScale([[0, 90]], { height: 90, padding: 0, width: 100 });

  it("shows four ticks when no tag is near them", () => {
    expect(layoutAxis(scale, [], format)).toEqual({
      tags: [],
      ticks: [
        { text: "90", top: -7 },
        { text: "60", top: 23 },
        { text: "30", top: 53 },
        { text: "0", top: 83 },
      ],
    });
  });

  it("keeps tags inside the plot, pushes them apart, and hides clashing ticks", () => {
    const layout = layoutAxis(
      scale,
      [
        { color: "a", text: "A", value: 0 },
        { color: "b", text: "B", value: 20 },
        { color: "c", text: "C", value: 60 },
      ],
      format,
    );
    expect(layout.tags.map((tag) => tag.text)).toEqual(["C", "B", "A"]);
    expect(layout.tags.map((tag) => Math.round(tag.top))).toEqual([
      21,
      90 - AXIS_TAG_HEIGHT - 19,
      90 - AXIS_TAG_HEIGHT,
    ]);
    expect(layout.ticks.map((tick) => tick.text)).toEqual(["90"]);
  });

  it("keeps the top tag at the top edge", () => {
    const layout = layoutAxis(scale, [{ color: "a", text: "A", value: 95 }], format);
    expect(layout.tags[0]?.top).toBe(0);
  });
});

describe("findNearestPointIndex", () => {
  it("snaps a position to the closest drawn point", () => {
    const scale = requireScale([[1, 2, 3, 4, 5]]);
    const points = downsampleSeries([1, 2, 3, 4, 5]);
    expect(findNearestPointIndex(points, scale, -10)).toBe(0);
    expect(findNearestPointIndex(points, scale, 90)).toBe(2);
    expect(findNearestPointIndex(points, scale, 400)).toBe(4);
  });
});
