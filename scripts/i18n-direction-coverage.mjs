#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(resolve(root, "i18n/direction.config.json"), "utf8"));
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const utility = /(?<![A-Za-z0-9_-])((?:[A-Za-z0-9_-]+:)*(?:-?(?:ml|mr|pl|pr|left|right)(?:-[A-Za-z0-9_./\[\]%-]+)?|text-(?:left|right)|border-(?:l|r)(?:-[A-Za-z0-9_./\[\]%-]+)?|rounded-(?:l|r|tl|tr|bl|br)(?:-[A-Za-z0-9_./\[\]%-]+)?|float-(?:left|right)))(?![A-Za-z0-9_-])/g;
const css = /\b((?:margin|padding|border)-(?:left|right)(?:-[a-z-]+)?|(?:left|right)|text-align|float)\s*:\s*([^;}{]+)/g;
const rows = [];
for (const path of tracked) {
  if (!config.roots.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
  if (!/\.(?:[cm]?[jt]sx?|css|scss)$/.test(path)) continue;
  const lines = readFileSync(resolve(root, path), "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(utility)) rows.push({ path, line: index + 1, kind: "physical-utility", token: match[1], source: line.trim() });
    for (const match of line.matchAll(css)) {
      if (match[1] === "text-align" && !/^\s*(?:left|right)\s*$/.test(match[2])) continue;
      if (match[1] === "float" && !/^\s*(?:left|right)\s*$/.test(match[2])) continue;
      rows.push({ path, line: index + 1, kind: "physical-css", token: `${match[1]}:${match[2].trim()}`, source: line.trim() });
    }
  });
}
for (const row of rows) {
  const exception = (config.exceptions ?? []).find((item) => item.path === row.path && item.token === row.token && item.source === row.source);
  row.disposition = exception ? "dir-scoped-exception" : "unowned-physical-direction";
  row.evidence = exception?.evidence ?? "physical direction requires a logical equivalent or an explicit dir-scoped justification";
}
rows.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.token.localeCompare(b.token));
const actionable = rows.filter((row) => row.disposition === "unowned-physical-direction").length;
const manifest = { schemaVersion: 1, repository: config.repository, roots: config.roots, counts: { total: rows.length, actionable, exceptions: rows.length - actionable }, rows };
if (process.argv.includes("--emit")) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
else {
  if (!existsSync(resolve(root, config.manifest))) throw new Error(`Committed direction manifest is missing: ${config.manifest}`);
  const committed = JSON.parse(readFileSync(resolve(root, config.manifest), "utf8"));
  if (JSON.stringify(committed) !== JSON.stringify(manifest)) throw new Error("Committed direction manifest is stale.");
  if (actionable) throw new Error(`${actionable} physical-direction matches remain unowned.`);
  console.log(JSON.stringify(manifest.counts));
}
