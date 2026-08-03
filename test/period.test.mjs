import assert from "node:assert/strict";
import test from "node:test";

import { latestCommonPeriod, normalizePeriod, parseReportPeriod } from "../scripts/lib/period.mjs";

test("parses Arabic and Chinese report years", () => {
  assert.equal(parseReportPeriod("某基金2026年第2季度报告"), "2026Q2");
  assert.equal(parseReportPeriod("某基金二0二六年第2季度报告"), "2026Q2");
  assert.equal(parseReportPeriod("某基金二〇二五年第四季度报告"), "2025Q4");
});

test("normalizes an explicit period", () => {
  assert.equal(normalizePeriod("2026q2"), "2026Q2");
  assert.throws(() => normalizePeriod("2026Q5"));
});

test("selects the latest common period", () => {
  const funds = [{ code: "a", short_name: "A" }, { code: "b", short_name: "B" }];
  const rows = new Map([
    ["a", [{ TITLE: "基金2026年第2季度报告" }, { TITLE: "基金2026年第1季度报告" }]],
    ["b", [{ TITLE: "基金2026年第1季度报告" }, { TITLE: "基金2025年第4季度报告" }]],
  ]);
  assert.equal(latestCommonPeriod(funds, rows), "2026Q1");
});
