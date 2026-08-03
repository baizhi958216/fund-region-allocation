#!/usr/bin/env python3
import argparse
import json
import pathlib


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()
    rows = json.loads(pathlib.Path(args.input).read_text(encoding="utf-8"))
    errors = []
    for row in rows:
        label = f"{row['code']} {row['short_name']}"
        total = sum(row["allocation"].values())
        if abs(total - 100) > 0.15:
            errors.append(f"{label}: displayed total is {total:.4f}%")
        if abs(row["calculated_country_total"] - row["reported_equity_country_total"]) > 0.15:
            errors.append(f"{label}: parsed countries do not match report total")
        if row["allocation"]["现金及其他"] < -0.15:
            errors.append(f"{label}: negative residual")
        if not row.get("source_page") or not row.get("pdf_url"):
            errors.append(f"{label}: missing evidence")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Validated {len(rows)} funds")


if __name__ == "__main__":
    main()
