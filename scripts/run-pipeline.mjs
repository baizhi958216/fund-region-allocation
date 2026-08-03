#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseArgs, requireArgs } from "./lib/cli.mjs";
import { ensureDirectory } from "./lib/files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} exited with status ${result.status}`);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, ["reference-label"]);
  requireArgs(args, ["period", "output-dir"]);
  const outputDirectory = path.resolve(args["output-dir"]);
  const workDirectory = args["work-dir"] ? path.resolve(args["work-dir"]) : path.join(outputDirectory, ".work");
  await ensureDirectory(workDirectory);
  const manifest = path.join(workDirectory, "manifest.json");
  const extracted = path.join(workDirectory, "allocations.json");
  run("fetch-reports.mjs", [
    "--funds", path.join(root, "assets", "funds.json"), "--period", args.period,
    "--report-dir", path.join(workDirectory, "reports"), "--manifest", manifest,
  ]);
  run("extract-allocations.mjs", ["--manifest", manifest, "--output", extracted]);
  run("validate-data.mjs", ["--input", extracted]);
  const renderArgs = [
    "--input", extracted, "--style", path.join(root, "assets", "chart-style.json"),
    "--output-dir", outputDirectory,
  ];
  if (args["reference-label"]) renderArgs.push("--reference-label");
  run("render-chart.mjs", renderArgs);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
