#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { parseArgs, requireArgs } from "./lib/cli.mjs";
import { readJson } from "./lib/files.mjs";

export function validate(rows) {
  const errors = [];
  for (const row of rows) {
    const label = `${row.code} ${row.short_name}`;
    const total = Object.values(row.allocation).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.15) errors.push(`${label}: displayed total is ${total.toFixed(4)}%`);
    if (Math.abs(row.calculated_country_total - row.reported_equity_country_total) > 0.15) {
      errors.push(`${label}: parsed countries do not match report total`);
    }
    if (row.allocation["现金及其他"] < -0.15) errors.push(`${label}: negative residual`);
    if (!row.source_page || !row.pdf_url) errors.push(`${label}: missing evidence`);
  }
  return errors;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  requireArgs(args, ["input"]);
  const rows = await readJson(args.input);
  const errors = validate(rows);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Validated ${rows.length} funds`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
