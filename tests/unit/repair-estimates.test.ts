import { describe, expect, it } from "vitest";
import { pickEstimate, sumEstimates, type EstimateRow } from "@/lib/repair-estimates";

const rows: EstimateRow[] = [
  { issueTypeId: "screen", modelId: null, minPaise: 249900, maxPaise: 1499900 },
  { issueTypeId: "screen", modelId: "iphone-16-pro", minPaise: 1699900, maxPaise: 3199900 },
  { issueTypeId: "battery", modelId: null, minPaise: 129900, maxPaise: null },
];

describe("pickEstimate", () => {
  it("prefers the model-specific override", () => {
    expect(pickEstimate(rows, "screen", "iphone-16-pro")).toEqual({ minPaise: 1699900, maxPaise: 3199900 });
  });
  it("falls back to the issue-wide default", () => {
    expect(pickEstimate(rows, "screen", "pixel-9")).toEqual({ minPaise: 249900, maxPaise: 1499900 });
  });
  it("returns null when the service has no estimate", () => {
    expect(pickEstimate(rows, "water", "pixel-9")).toBeNull();
  });
  it("drops a max that is not above the min", () => {
    expect(pickEstimate([{ issueTypeId: "x", modelId: null, minPaise: 500, maxPaise: 500 }], "x", "m")).toEqual({ minPaise: 500, maxPaise: null });
  });
});

describe("sumEstimates", () => {
  it("adds ranges and treats single prices as both ends", () => {
    expect(sumEstimates([{ minPaise: 1000, maxPaise: 3000 }, { minPaise: 500, maxPaise: null }])).toEqual({ minPaise: 1500, maxPaise: 3500, unpriced: 0 });
  });
  it("counts services without an estimate separately", () => {
    expect(sumEstimates([null, { minPaise: 800, maxPaise: null }])).toEqual({ minPaise: 800, maxPaise: null, unpriced: 1 });
  });
});
