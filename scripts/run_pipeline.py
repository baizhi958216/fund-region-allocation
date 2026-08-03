#!/usr/bin/env python3
import argparse
import os
import pathlib
import subprocess
import sys


def run(*args):
    subprocess.run([sys.executable, *map(str, args)], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--period", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--work-dir")
    parser.add_argument("--reference-label", action="store_true")
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent.parent
    output_dir = pathlib.Path(args.output_dir).resolve()
    work_dir = pathlib.Path(args.work_dir).resolve() if args.work_dir else output_dir / ".work"
    work_dir.mkdir(parents=True, exist_ok=True)
    manifest = work_dir / "manifest.json"
    extracted = work_dir / "allocations.json"
    run(root / "scripts/fetch_reports.py", "--funds", root / "assets/funds.json", "--period", args.period, "--report-dir", work_dir / "reports", "--manifest", manifest)
    run(root / "scripts/extract_allocations.py", "--manifest", manifest, "--output", extracted)
    run(root / "scripts/validate_data.py", "--input", extracted)
    render_args = [root / "scripts/render_chart.py", "--input", extracted, "--style", root / "assets/chart-style.json", "--output-dir", output_dir]
    if args.reference_label:
        render_args.append("--reference-label")
    run(*render_args)


if __name__ == "__main__":
    main()
