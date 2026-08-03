#!/usr/bin/env python3
import argparse
import json
import pathlib
import re

import pdfplumber


TARGET_HEADING = "在各个国家（地区）证券市场的股票及存托凭证投资分布"
NUMBER = re.compile(r"(-?\d+(?:\.\d+)?)\s*$")
COUNTRY_MAP = {
    "美国": "美国", "中国": "中国", "中国大陆": "中国", "中国内地": "中国",
    "中国香港": "中国香港", "香港": "中国香港",
    "韩国": "韩国", "日本": "日本",
}


def clean_country(value):
    return re.sub(r"\s+", "", value).strip("：:")


def parse_table(text):
    compact = text.replace("(", "（").replace(")", "）")
    if TARGET_HEADING not in compact:
        return None
    lines = compact.splitlines()
    start = next(i for i, line in enumerate(lines) if TARGET_HEADING in line)
    rows = []
    total = None
    footnote = ""
    for line in lines[start + 1:]:
        stripped = line.strip()
        if stripped.startswith("注：") and rows:
            footnote = stripped
            break
        match = NUMBER.search(stripped)
        if not match:
            continue
        pct = float(match.group(1))
        prefix = stripped[:match.start()].strip()
        if prefix.startswith("合计"):
            total = pct
            break
        country = clean_country(prefix.split()[0] if prefix.split() else "")
        if not country or country in {"国家（地区）", "公允价值（人民币元）"}:
            continue
        if any(token in country for token in ["占基金", "资产净值", "比例"]):
            continue
        rows.append((country, pct))
    if not rows or total is None:
        return None
    return rows, total, footnote


def extract_one(item):
    found = None
    with pdfplumber.open(item["pdf_path"]) as pdf:
        page_texts = [page.extract_text(x_tolerance=2, y_tolerance=2) or "" for page in pdf.pages]
        for page_index, text in enumerate(page_texts):
            # Country tables occasionally continue with the total and footnote
            # on the following page.
            window = text + "\n" + (page_texts[page_index + 1] if page_index + 1 < len(page_texts) else "")
            parsed = parse_table(window)
            if parsed:
                rows, total, footnote = parsed
                found = (page_index + 1, rows, total, footnote)
                break
    if not found:
        raise RuntimeError(f"{item['code']} {item['short_name']}: country table not found")
    page_number, rows, reported_total, footnote = found
    allocation = {name: 0.0 for name in ["美国", "中国", "中国香港", "韩国", "日本", "其他"]}
    raw_rows = []
    for country, pct in rows:
        category = COUNTRY_MAP.get(country, "其他")
        allocation[category] += pct
        raw_rows.append({"country": country, "category": category, "percent_nav": pct})
    calculated_total = sum(allocation.values())
    residual = 100.0 - reported_total
    allocation["现金及其他"] = residual
    return {
        **{key: value for key, value in item.items() if key != "pdf_path"},
        "report_date": item["period"][:4] + "-" + {"Q1":"03-31", "Q2":"06-30", "Q3":"09-30", "Q4":"12-31"}[item["period"][4:]],
        "source_page": page_number,
        "classification_note": footnote,
        "raw_country_rows": raw_rows,
        "reported_equity_country_total": reported_total,
        "calculated_country_total": round(calculated_total, 6),
        "allocation": {key: round(value, 6) for key, value in allocation.items()},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    manifest = json.loads(pathlib.Path(args.manifest).read_text(encoding="utf-8"))
    result = [extract_one(item) for item in manifest]
    pathlib.Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extracted {len(result)} reports")


if __name__ == "__main__":
    main()
