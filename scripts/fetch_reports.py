#!/usr/bin/env python3
import argparse
import json
import pathlib
import re
import urllib.parse
import urllib.request


API = "https://api.fund.eastmoney.com/f10/JJGG"
YEAR_DIGITS = str.maketrans("零〇○一二三四五六七八九", "000123456789")
QUARTER_DIGITS = {"一": "1", "二": "2", "三": "3", "四": "4"}


def request_json(url):
    req = urllib.request.Request(url, headers={"Referer": "https://fundf10.eastmoney.com/", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def normalize_period(period):
    match = re.fullmatch(r"(\d{4})Q([1-4])", period.upper())
    if not match:
        raise ValueError("period must be 'latest' or look like 2026Q2")
    return f"{match.group(1)}Q{match.group(2)}"


def parse_report_period(title):
    match = re.search(r"([0-9零〇○一二三四五六七八九]{4})年第([1-4一二三四])季度报告", title)
    if not match:
        return None
    year = match.group(1).translate(YEAR_DIGITS)
    quarter = QUARTER_DIGITS.get(match.group(2), match.group(2))
    return f"{year}Q{quarter}"


def announcement_rows(fund_code):
    query = urllib.parse.urlencode({"fundcode": fund_code, "pageIndex": 1, "pageSize": 50, "type": 3})
    return request_json(f"{API}?{query}").get("Data") or []


def resolve_latest_period(funds, rows_by_code):
    common = None
    for fund in funds:
        periods = {
            period
            for row in rows_by_code[fund["code"]]
            if (period := parse_report_period(row.get("TITLE", "")))
        }
        if not periods:
            raise RuntimeError(f"{fund['code']} {fund['short_name']}: no quarterly reports found")
        common = periods if common is None else common & periods
    if not common:
        raise RuntimeError("the configured funds have no common reporting quarter")
    return max(common, key=lambda value: (int(value[:4]), int(value[-1])))


def fetch_one(fund, period, report_dir, rows):
    matches = [
        row for row in rows
        if parse_report_period(row.get("TITLE", "")) == period
    ]
    if not matches:
        raise RuntimeError(f"{fund['code']} {fund['short_name']}: report not found for {period}")
    row = matches[0]
    report_id = row["ID"]
    pdf_url = f"https://pdf.dfcfw.com/pdf/H2_{report_id}_1.pdf"
    pdf_path = report_dir / f"{fund['code']}-{period}.pdf"
    req = urllib.request.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"{fund['code']}: downloaded content is not a PDF")
    pdf_path.write_bytes(data)
    return {
        **fund,
        "period": period,
        "report_title": row["TITLE"],
        "publish_date": row["PUBLISHDATEDesc"],
        "report_id": report_id,
        "retrieval_mirror": "天天基金/东方财富基金公告接口",
        "pdf_url": pdf_url,
        "pdf_path": str(pdf_path.resolve()),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--funds", required=True)
    parser.add_argument("--period", required=True, help="YYYYQn or latest")
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()
    funds = json.loads(pathlib.Path(args.funds).read_text(encoding="utf-8"))
    rows_by_code = {fund["code"]: announcement_rows(fund["code"]) for fund in funds}
    if args.period.lower() == "latest":
        period = resolve_latest_period(funds, rows_by_code)
        print(f"Resolved latest common period: {period}")
    else:
        period = normalize_period(args.period)
    report_dir = pathlib.Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    manifest = [fetch_one(fund, period, report_dir, rows_by_code[fund["code"]]) for fund in funds]
    pathlib.Path(args.manifest).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Downloaded {len(manifest)} reports")


if __name__ == "__main__":
    main()
