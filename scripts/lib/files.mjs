import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
}
