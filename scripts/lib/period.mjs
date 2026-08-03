const YEAR_DIGITS = new Map([
  ["零", "0"], ["〇", "0"], ["○", "0"],
  ["一", "1"], ["二", "2"], ["三", "3"], ["四", "4"],
  ["五", "5"], ["六", "6"], ["七", "7"], ["八", "8"], ["九", "9"],
]);
const QUARTER_DIGITS = new Map([["一", "1"], ["二", "2"], ["三", "3"], ["四", "4"]]);

export function normalizePeriod(period) {
  const match = /^(\d{4})Q([1-4])$/i.exec(period);
  if (!match) {
    throw new Error("period must be 'latest' or look like 2026Q2");
  }
  return `${match[1]}Q${match[2]}`;
}

export function parseReportPeriod(title) {
  const match = /([0-9零〇○一二三四五六七八九]{4})年第([1-4一二三四])季度报告/.exec(title);
  if (!match) return null;
  const year = [...match[1]].map((character) => YEAR_DIGITS.get(character) ?? character).join("");
  const quarter = QUARTER_DIGITS.get(match[2]) ?? match[2];
  return `${year}Q${quarter}`;
}

export function latestCommonPeriod(funds, rowsByCode) {
  let common = null;
  for (const fund of funds) {
    const periods = new Set(
      rowsByCode.get(fund.code)
        .map((row) => parseReportPeriod(row.TITLE ?? ""))
        .filter(Boolean),
    );
    if (periods.size === 0) {
      throw new Error(`${fund.code} ${fund.short_name}: no quarterly reports found`);
    }
    common = common === null
      ? periods
      : new Set([...common].filter((period) => periods.has(period)));
  }
  if (!common || common.size === 0) {
    throw new Error("the configured funds have no common reporting quarter");
  }
  return [...common].sort((left, right) => {
    const leftKey = Number(left.slice(0, 4)) * 10 + Number(left.at(-1));
    const rightKey = Number(right.slice(0, 4)) * 10 + Number(right.at(-1));
    return rightKey - leftKey;
  })[0];
}
