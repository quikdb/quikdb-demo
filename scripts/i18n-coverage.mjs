#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(resolve(root, "i18n/coverage.config.json"), "utf8"));
const clean = (value) => value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const visible = (value) => /[A-Za-z\u0600-\u06ff]/.test(value) && value.length > 1;
const keyFor = (value) => `source.${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const explicit = new Set();

const flatten = (value) => {
  if (typeof value === "string") explicit.add(value);
  else if (value && typeof value === "object") Object.values(value).forEach(flatten);
};
for (const file of config.explicitCatalogues ?? []) flatten(JSON.parse(readFileSync(resolve(root, file), "utf8")));

const matchesPrefix = (file, prefixes = []) => prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`));
const technical = (value) => /^(?:https?:|mailto:|\/|#|--|[A-Z0-9_]+$|[\w.-]+@[\w.-]+$)/.test(value)
  || /(?:\b(?:GET|POST|PATCH|PUT|DELETE)\b|\b(?:npm|npx|yarn|curl|git|docker|kubectl)\b|\.(?:com|net|io|dev)\b)/i.test(value);
const rows = [];

for (const file of tracked) {
  if (!config.roots.some((prefix) => file === prefix || file.startsWith(`${prefix}/`))) continue;
  if (!/\.(?:[cm]?[jt]sx?|mdx?)$/.test(file)) continue;
  if (matchesPrefix(file, config.excludePrefixes)) continue;
  const lines = readFileSync(resolve(root, file), "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const found = new Map();
    const add = (kind, raw) => {
      const value = clean(raw);
      if (visible(value)) found.set(`${kind}\0${value}`, { kind, value });
    };
    if (/\.mdx?$/.test(file)) {
      const prose = line.replace(/^\s{0,3}(?:#{1,6}|[-*+] |\d+\. |> |\|)\s*/, "");
      if (prose && !/^\s*(?:```|---|import |export |<[^>]+>)\s*$/.test(line)) add("prose", prose);
    } else {
      for (const match of line.matchAll(/<[A-Za-z][^>]*>([^<>{}]*[A-Za-z\u0600-\u06ff][^<>{}]*)</g)) add("jsx-text", match[1]);
      for (const match of line.matchAll(/\b(?:aria-label|aria-description|alt|placeholder|title)\s*=\s*["']([^"']+)["']/g)) add("a11y-or-attribute", match[1]);
      for (const match of line.matchAll(/\b(?:label|title|description|message|caption|heading|emptyText)\s*:\s*["'`]([^"'`]+)["'`]/g)) add("ui-model", match[1]);
      for (const match of line.matchAll(/\b(?:toast\.(?:success|error|info|warning)|alert|confirm|setError)\s*\(\s*["'`]([^"'`]+)["'`]/g)) add("feedback", match[1]);
      for (const match of line.matchAll(/\{\s*["'`]([^"'`]*[A-Za-z\u0600-\u06ff][^"'`]*)["'`]\s*\}/g)) add("jsx-expression", match[1]);
    }
    for (const { kind, value } of found.values()) {
      let disposition = "catalogue-source";
      let evidence = keyFor(value);
      if (matchesPrefix(file, config.authoredContentPrefixes)) {
        disposition = "excluded-authored-content";
        evidence = config.authoredContentEvidence;
      } else if (technical(value)) {
        disposition = "excluded-technical";
        evidence = "URL, command, protocol token, email address or technical identifier";
      } else if (explicit.has(value)) {
        disposition = "catalogue-explicit";
        evidence = "explicit stable-key English catalogue";
      }
      rows.push({ path: file, line: index + 1, kind, englishSource: value, disposition, evidence });
    }
  });
}

rows.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.englishSource.localeCompare(b.englishSource));
const sourceCatalogue = Object.fromEntries([...new Set(rows.filter((row) => row.disposition === "catalogue-source").map((row) => row.englishSource))]
  .sort().map((value) => [keyFor(value), value]));
const counts = rows.reduce((result, row) => ({ ...result, [row.disposition]: (result[row.disposition] ?? 0) + 1 }), {});
const manifest = {
  schemaVersion: 1,
  repository: config.repository,
  activeRoutes: config.activeRoutes,
  counts: { total: rows.length, ...counts, unowned: 0 },
  exclusions: {
    authoredContent: config.authoredContentEvidence,
    technical: "URLs, commands, protocol tokens, email addresses and technical identifiers remain verbatim.",
    userContent: "Runtime user-authored content is not a source literal and is outside this source manifest.",
  },
  rows,
};
const bundle = { sourceCatalogue, manifest };

if (process.argv.includes("--emit")) {
  process.stdout.write(JSON.stringify(bundle));
} else {
  const expectedCatalogue = JSON.parse(readFileSync(resolve(root, config.sourceCatalogue), "utf8"));
  const expectedManifest = JSON.parse(readFileSync(resolve(root, config.manifest), "utf8"));
  if (JSON.stringify(expectedCatalogue) !== JSON.stringify(sourceCatalogue)) throw new Error("English source catalogue is stale; regenerate the coverage ledger.");
  if (JSON.stringify(expectedManifest) !== JSON.stringify(manifest)) throw new Error("Coverage manifest is stale or contains an unowned active-route string.");
  console.log(JSON.stringify(manifest.counts));
}
