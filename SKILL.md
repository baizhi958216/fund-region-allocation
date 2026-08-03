---
name: fund-region-allocation
description: Fetch, extract, validate, compare, and visualize geographic allocation data from Chinese public fund periodic reports. Use when Codex needs to analyze QDII fund country or region exposure, compare funds by US/China/Hong Kong allocations, reproduce a regional allocation ranking chart, or generate evidence-backed CSV, JSON, SVG, and PNG outputs for a reporting quarter.
---

# Fund Region Allocation

Use deterministic PDF extraction and chart rendering. Do not use generative image tools for percentages or labels.

## Workflow

1. Read the fund universe from `assets/funds.json`, or create an equivalent input file when the user supplies another list.
2. Fetch the requested periodic report with `scripts/fetch_reports.py`.
3. Extract the report table titled `报告期末在各个国家（地区）证券市场的股票及存托凭证投资分布` with `scripts/extract_allocations.py`.
4. Normalize country rows according to `references/allocation-rules.md`.
5. Treat `100 - total country/region equity allocation` as the chart's gray residual. Label it `现金及其他` unless the user explicitly asks to reproduce a reference image that labels the residual `现金`.
6. Run `scripts/validate_data.py`; do not render data that fails validation.
7. Render the ranked chart with `scripts/render_chart.py`.
8. Return the PNG/SVG, CSV/JSON, and evidence file containing report titles, URLs, dates, and source pages.

Run the complete workflow:

```bash
python scripts/run_pipeline.py --period 2026Q2 --output-dir OUTPUT_DIR
```

Use `--period latest` to select the newest reporting quarter available for every configured fund. This prevents mixed-period charts when a release is triggered automatically.

## Safeguards

- Never infer a full regional allocation from top holdings.
- Never silently replace a missing region table with zero.
- Preserve source percentages before display rounding.
- Do not mix reporting periods.
- Deduplicate share classes that use the same investment portfolio.
- Classify countries by the report's own method; retain the report footnote in evidence.
- Require all displayed segments to reconcile to 100% within 0.15 percentage points.
- Mark non-official mirrors as retrieval mirrors, while preserving the original report title and publication date.

## Dependencies

Use Python 3 with `pdfplumber` and `Pillow`. Prefer the Codex bundled Python runtime when available.
