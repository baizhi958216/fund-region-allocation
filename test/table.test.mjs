import assert from "node:assert/strict";
import test from "node:test";

import { parseTable } from "../scripts/extract-allocations.mjs";
import { validate } from "../scripts/validate-data.mjs";

test("parses a country allocation table", () => {
  const text = `
5.2 报告期末在各个国家（地区）证券市场的股票及存托凭证投资分布
国家（地区） 公允价值（人民币元） 占基金资产净值比例（%）
美国 6,131,699,224.72 87.89
中国香港 178,066,467.02 2.55
合计 6,309,765,691.74 90.44
注：根据证券交易所确定。
`;
  assert.deepEqual(parseTable(text), {
    rows: [["美国", 87.89], ["中国香港", 2.55]],
    total: 90.44,
    footnote: "",
  });
});

test("rejects inconsistent allocation evidence", () => {
  const errors = validate([{
    code: "000000",
    short_name: "示例",
    allocation: { 美国: 80, "现金及其他": 10 },
    calculated_country_total: 80,
    reported_equity_country_total: 80,
    source_page: 1,
    pdf_url: "https://example.com/report.pdf",
  }]);
  assert.equal(errors.length, 1);
});
