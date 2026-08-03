# Allocation rules

## Source table

Extract the periodic-report table headed `报告期末在各个国家（地区）证券市场的股票及存托凭证投资分布`. Use the final column, `占基金资产净值比例（%）`.

## Normalization

- `美国` -> `美国`
- `中国`, `中国大陆`, or `中国内地` -> `中国`
- `中国香港` or `香港` -> `中国香港`
- `韩国` -> `韩国`
- `日本` -> `日本`
- Every other reported country or region -> `其他`

Use exact matching after removing whitespace. Do not classify `中国香港` as `中国`.

## Residual

Compute `现金及其他 = 100 - 合计国家地区股票占净值比例`. This residual can include cash, funds, bonds, derivatives, receivables, liabilities, and other non-equity balance-sheet items. It is not necessarily literal cash.

To reproduce a supplied visual, the renderer may display this segment as `现金`, but evidence and machine-readable outputs must retain the accurate field name `现金及其他`.

## Report footnote

Preserve the report's country-classification footnote. Many reports classify a stock by its exchange, but the exact report footnote is authoritative.
