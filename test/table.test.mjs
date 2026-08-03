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

test("parses explicit no-equity-holdings statement", () => {
  const text = `
3.2 报告期末在各个国家（地区）证券市场的股票及存托凭证投资分布
本基金本报告期末未持有股票及存托凭证。
`;
  assert.deepEqual(parseTable(text), {
    rows: [],
    total: 0,
    footnote: "",
  });
});

test("parses allocation table without explicit total row", () => {
  const text = `
5.2 报告期末在各个国家（地区）证券市场的股票及存托凭证投资分布
国家（地区） 公允价值（人民币元） 占基金资产净值比例（％）
中国香港 87,416,587.06 3.50
5.3 报告期末按行业分类的股票及存托凭证投资组合
行业类别 公允价值（人民币元） 占基金资产净值比例（％）
科技 58,273,225.62 2.33
`;
  assert.deepEqual(parseTable(text), {
    rows: [["中国香港", 3.50]],
    total: 3.50,
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
