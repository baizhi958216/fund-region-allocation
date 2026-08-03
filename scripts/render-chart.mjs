#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { parseArgs, requireArgs } from "./lib/cli.mjs";
import { ensureDirectory, readJson, writeJson } from "./lib/files.mjs";

const CATEGORIES = ["美国", "中国", "中国香港", "韩国", "日本", "其他", "现金及其他"];
const WIDTH = 1080;

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function svgText(x, y, value, size, color, weight = 400, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="PingFang SC,Noto Sans CJK SC,Arial Unicode MS,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function displayPercent(value) {
  return `${Math.round(value)}%`;
}

function estimatedTextWidth(value, size) {
  return [...value].reduce((sum, character) => sum + (/^[\x00-\xff]$/.test(character) ? size * 0.56 : size), 0);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function createSvg(rows, style, referenceLabel) {
  const rowStart = 260;
  const rowGap = 64;
  const barHeight = 42;
  const footnoteY = rowStart + rows.length * rowGap + 20;
  const height = footnoteY + 45;

  const background = "#F7F2E7";
  const ink = "#153B43";
  const muted = "#52666B";
  const period = rows[0].period;
  const reportDate = rows[0].report_date;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    `<rect width="${WIDTH}" height="${height}" fill="${background}"/>`,
    svgText(55, 82, `${style.title} | ${period}`, 45, ink, 700),
    svgText(57, 128, `${style.subtitle}  |  数据来源：基金${period.slice(0, 4)}年第${period.at(-1)}季度报告`, 22, "#344C52"),
    '<rect x="56" y="147" width="236" height="41" rx="8" fill="#E9E5D9"/>',
    svgText(72, 177, `数据截止：${reportDate}`, 17, muted),
  ];

  const legendLabels = CATEGORIES.map((category) => referenceLabel && category === "现金及其他" ? "现金" : category);
  let legendX = 57;
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const category = CATEGORIES[index];
    const label = legendLabels[index];
    parts.push(`<rect x="${legendX}" y="207" width="20" height="20" rx="3" fill="${style.colors[category]}"/>`);
    parts.push(svgText(legendX + 27, 224, label, 17, "#344C52"));
    legendX += 27 + estimatedTextWidth(label, 17) + 28;
  }

  const chartX = 320;
  const chartWidth = 700;
  rows.forEach((row, rowIndex) => {
    const rank = rowIndex + 1;
    const y = rowStart + rowIndex * rowGap;
    parts.push(`<rect x="56" y="${y + 5}" width="33" height="33" rx="7" fill="#0B5667"/>`);
    parts.push(svgText(72.5, y + 29, String(rank), 17, "white", 600, "middle"));
    parts.push(svgText(100, y + 31, row.short_name, 20, ink, 500));
    let x = chartX;
    for (const category of CATEGORIES) {
      const value = row.allocation[category];
      const segmentWidth = chartWidth * value / 100;
      parts.push(`<rect x="${x.toFixed(2)}" y="${y}" width="${segmentWidth.toFixed(2)}" height="${barHeight}" fill="${style.colors[category]}"/>`);
      if (value >= 3) {
        const color = category === "现金及其他" ? ink : "white";
        parts.push(svgText(x + segmentWidth / 2, y + 28, displayPercent(value), 17, color, 600, "middle"));
      }
      x += segmentWidth;
    }
  });
  const footnote = "注：地域占比取报告‘按国家（地区）分类’表；灰色为100%减去股票地域合计，包含现金及其他非股票项目。";
  parts.push(svgText(56, footnoteY, footnote, 17, "#63757A"));
  parts.push("</svg>");
  return parts.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, ["reference-label"]);
  requireArgs(args, ["input", "style", "output-dir"]);
  const rows = await readJson(args.input);
  const style = await readJson(args.style);
  rows.sort((left, right) => right.allocation["美国"] - left.allocation["美国"]);
  await ensureDirectory(args["output-dir"]);
  const period = rows[0].period;
  const svgPath = path.resolve(args["output-dir"], `fund-region-allocation-${period}.svg`);
  const pngPath = path.resolve(args["output-dir"], `fund-region-allocation-${period}.png`);
  const csvPath = path.resolve(args["output-dir"], `fund-region-allocation-${period}.csv`);
  const evidencePath = path.resolve(args["output-dir"], `fund-region-allocation-${period}-evidence.json`);
  const svg = createSvg(rows, style, Boolean(args["reference-label"]));
  await writeFile(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  const header = ["rank", "fund_code", "fund_name", ...CATEGORIES, "report_date", "source_page", "pdf_url"];
  const records = rows.map((row, index) => [
    index + 1, row.code, row.short_name, ...CATEGORIES.map((category) => row.allocation[category]),
    row.report_date, row.source_page, row.pdf_url,
  ]);
  const csv = [header, ...records].map((record) => record.map(csvCell).join(",")).join("\r\n");
  await writeFile(csvPath, `\uFEFF${csv}\r\n`, "utf8");
  await writeJson(evidencePath, rows);
  console.log(pngPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
