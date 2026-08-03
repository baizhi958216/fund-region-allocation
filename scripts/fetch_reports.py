#!/usr/bin/env python3
import argparse
import json
import pathlib
import re
import urllib.parse
import urllib.request


API = "https://api.fund.eastmoney.com/f10/JJGG"


def request_json(url):
    req = urllib.request.Request(url, headers={"Referer": "https://fundf10.eastmoney.com/", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def target_title(period):
    match = re.fullmatch(r"(\d{4})Q([1-4])", period.upper())
    if not match:
        raise ValueError("period must look like 2026Q2")
    return match.group(1), f"第{match.group(2)}季度报告"


def fetch_one(fund, period, report_dir):
    query = urllib.parse.urlencode({"fundcode": fund["code"], "pageIndex": 1, "pageSize": 50, "type": 3})
    rows = request_json(f"{API}?{query}").get("Data") or []
    year, wanted = target_title(period)
    matches = [
        row for row in rows
        if wanted in row.get("TITLE", "")
        and str(row.get("PUBLISHDATEDesc", "")).startswith(year + "-")
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
    parser.add_argument("--period", required=True)
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()
    funds = json.loads(pathlib.Path(args.funds).read_text(encoding="utf-8"))
    report_dir = pathlib.Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    manifest = [fetch_one(fund, args.period, report_dir) for fund in funds]
    pathlib.Path(args.manifest).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Downloaded {len(manifest)} reports")


if __name__ == "__main__":
    main()
