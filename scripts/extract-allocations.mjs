#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { parseArgs, requireArgs } from "./lib/cli.mjs";
import { readJson, writeJson } from "./lib/files.mjs";

const TARGET_HEADING = "在各个国家（地区）证券市场的股票及存托凭证投资分布";
const CATEGORIES = ["美国", "中国", "中国香港", "韩国", "日本", "其他"];
const COUNTRY_MAP = new Map([
  ["美国", "美国"], ["中国", "中国"], ["中国大陆", "中国"], ["中国内地", "中国"],
  ["中国香港", "中国香港"], ["香港", "中国香港"], ["韩国", "韩国"], ["日本", "日本"],
]);
const STANDARD_FONT_DATA_URL = `${fileURLToPath(new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url))}${path.sep}`;

function pageLines(items) {
  const lines = [];
  const sorted = items
    .filter((item) => typeof item.str === "string" && item.str.length > 0)
    .map((item) => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width ?? 0 }))
    .sort((left, right) => Math.abs(right.y - left.y) > 2 ? right.y - left.y : left.x - right.x);
  for (const item of sorted) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (!line) {
      line = { y: item.y, parts: [] };
      lines.push(line);
    }
    line.parts.push(item);
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => {
      const parts = line.parts.sort((left, right) => left.x - right.x);
      let value = "";
      let previous = null;
      for (const part of parts) {
        if (previous && !/\s$/.test(value) && !/^\s/.test(part.text)) {
          const gap = part.x - (previous.x + previous.width);
          if (gap > 3) value += " ";
        }
        value += part.text;
        previous = part;
      }
      return value.replace(/\s+/g, " ").trim();
    });
}

function cleanCountry(value) {
  return value.replace(/\s+/g, "").replace(/^[：:]+|[：:]+$/g, "");
}

export function parseTable(text) {
  const lines = text.replaceAll("(", "（").replaceAll(")", "）").split(/\r?\n/);
  const start = lines.findIndex((line) => line.replace(/\s+/g, "").includes(TARGET_HEADING));
  if (start < 0) return null;
  const rows = [];
  let total = null;
  let footnote = "";
  for (const rawLine of lines.slice(start + 1)) {
    const line = rawLine.trim();
    if (line.replace(/\s+/g, "").startsWith("注：") && rows.length) {
      footnote = line;
      break;
    }
    const match = /(-?\d+(?:\.\d+)?)\s*$/.exec(line);
    if (!match) continue;
    const percent = Number(match[1]);
    const prefix = line.slice(0, match.index).trim();
    if (prefix.replace(/\s+/g, "").startsWith("合计")) {
      total = percent;
      break;
    }
    const country = cleanCountry(prefix.split(/\s+/)[0] ?? "");
    if (!country || ["国家（地区）", "公允价值（人民币元）"].includes(country)) continue;
    if (["占基金", "资产净值", "比例"].some((token) => country.includes(token))) continue;
    rows.push([country, percent]);
  }
  return rows.length && total !== null ? { rows, total, footnote } : null;
}

async function extractPageTexts(pdfPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const pdf = await getDocument({ data, disableWorker: true, standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise;
  const texts = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    texts.push(pageLines(content.items).join("\n"));
  }
  await pdf.destroy();
  return texts;
}

async function extractOne(item) {
  const texts = await extractPageTexts(item.pdf_path);
  let found = null;
  for (let index = 0; index < texts.length; index += 1) {
    const window = `${texts[index]}\n${texts[index + 1] ?? ""}`;
    const parsed = parseTable(window);
    if (parsed) {
      found = { ...parsed, page: index + 1 };
      break;
    }
  }
  if (!found) throw new Error(`${item.code} ${item.short_name}: country table not found`);
  const allocation = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  const rawRows = found.rows.map(([country, percent]) => {
    const category = COUNTRY_MAP.get(country) ?? "其他";
    allocation[category] += percent;
    return { country, category, percent_nav: percent };
  });
  const calculatedTotal = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  allocation["现金及其他"] = 100 - found.total;
  const { pdf_path: ignoredPdfPath, ...evidence } = item;
  const quarterDates = { Q1: "03-31", Q2: "06-30", Q3: "09-30", Q4: "12-31" };
  return {
    ...evidence,
    report_date: `${item.period.slice(0, 4)}-${quarterDates[item.period.slice(4)]}`,
    source_page: found.page,
    classification_note: found.footnote,
    raw_country_rows: rawRows,
    reported_equity_country_total: found.total,
    calculated_country_total: Number(calculatedTotal.toFixed(6)),
    allocation: Object.fromEntries(Object.entries(allocation).map(([key, value]) => [key, Number(value.toFixed(6))])),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  requireArgs(args, ["manifest", "output"]);
  const manifest = await readJson(args.manifest);
  const result = [];
  for (const item of manifest) result.push(await extractOne(item));
  await writeJson(args.output, result);
  console.log(`Extracted ${result.length} reports`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
