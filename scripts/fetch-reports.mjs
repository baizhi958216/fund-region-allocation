#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseArgs, requireArgs } from "./lib/cli.mjs";
import { ensureDirectory, readJson, writeJson } from "./lib/files.mjs";
import { latestCommonPeriod, normalizePeriod, parseReportPeriod } from "./lib/period.mjs";

const API = "https://api.fund.eastmoney.com/f10/JJGG";
const REQUEST_HEADERS = {
  Referer: "https://fundf10.eastmoney.com/",
  "User-Agent": "Mozilla/5.0 fund-region-allocation/1.0",
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response;
}

async function announcementRows(fundCode) {
  const query = new URLSearchParams({ fundcode: fundCode, pageIndex: "1", pageSize: "50", type: "3" });
  const response = await request(`${API}?${query}`, { headers: REQUEST_HEADERS });
  const payload = await response.json();
  return payload.Data ?? [];
}

async function fetchOne(fund, period, reportDirectory, rows) {
  const row = rows.find((candidate) => parseReportPeriod(candidate.TITLE ?? "") === period);
  if (!row) throw new Error(`${fund.code} ${fund.short_name}: report not found for ${period}`);
  const pdfUrl = `https://pdf.dfcfw.com/pdf/H2_${row.ID}_1.pdf`;
  const pdfPath = path.resolve(reportDirectory, `${fund.code}-${period}.pdf`);
  const response = await request(pdfUrl, { headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] } });
  const data = Buffer.from(await response.arrayBuffer());
  if (data.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error(`${fund.code}: downloaded content is not a PDF`);
  }
  await writeFile(pdfPath, data);
  return {
    ...fund,
    period,
    report_title: row.TITLE,
    publish_date: row.PUBLISHDATEDesc,
    report_id: row.ID,
    retrieval_mirror: "天天基金/东方财富基金公告接口",
    pdf_url: pdfUrl,
    pdf_path: pdfPath,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  requireArgs(args, ["funds", "period", "report-dir", "manifest"]);
  const funds = await readJson(args.funds);
  const rowsByCode = new Map();
  for (const fund of funds) {
    rowsByCode.set(fund.code, await announcementRows(fund.code));
  }
  const period = args.period.toLowerCase() === "latest"
    ? latestCommonPeriod(funds, rowsByCode)
    : normalizePeriod(args.period);
  if (args.period.toLowerCase() === "latest") console.log(`Resolved latest common period: ${period}`);
  await ensureDirectory(args["report-dir"]);
  const manifest = [];
  for (const fund of funds) {
    manifest.push(await fetchOne(fund, period, args["report-dir"], rowsByCode.get(fund.code)));
  }
  await writeJson(args.manifest, manifest);
  console.log(`Downloaded ${manifest.length} reports`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
