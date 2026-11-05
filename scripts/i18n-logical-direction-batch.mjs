#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const config = JSON.parse(readFileSync(resolve(root, "i18n/direction.config.json"), "utf8"));
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const classCalls = new Set(["cn", "clsx", "cva", "twMerge"]);
const swapBase = (base) => {
  const negative = base.startsWith("-") ? "-" : "";
  const value = negative ? base.slice(1) : base;
  const pairs = [
    [/^ml(?=-)/, "ms"], [/^mr(?=-)/, "me"], [/^pl(?=-)/, "ps"], [/^pr(?=-)/, "pe"],
    [/^left(?=-)/, "start"], [/^right(?=-)/, "end"],
    [/^text-left$/, "text-start"], [/^text-right$/, "text-end"],
    [/^border-l(?=-|$)/, "border-s"], [/^border-r(?=-|$)/, "border-e"],
    [/^rounded-tl(?=-|$)/, "rounded-ss"], [/^rounded-tr(?=-|$)/, "rounded-se"],
    [/^rounded-bl(?=-|$)/, "rounded-es"], [/^rounded-br(?=-|$)/, "rounded-ee"],
    [/^rounded-l(?=-|$)/, "rounded-s"], [/^rounded-r(?=-|$)/, "rounded-e"],
    [/^float-left$/, "float-start"], [/^float-right$/, "float-end"],
  ];
  for (const [pattern, replacement] of pairs) if (pattern.test(value)) return negative + value.replace(pattern, replacement);
  return base;
};
const logicalClasses = (value) => value.replace(/[^\s]+/g, (token) => {
  const parts = token.split(":");
  parts[parts.length - 1] = swapBase(parts.at(-1));
  return parts.join(":");
});
const inClassContext = (node) => {
  let current = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current) && ["class", "className"].includes(current.name.getText().replace(/["']/g, ""))) return true;
    if (ts.isPropertyAssignment(current) && ["class", "className"].includes(current.name.getText().replace(/["']/g, ""))) return true;
    if (ts.isCallExpression(current)) {
      const callee = ts.isIdentifier(current.expression) ? current.expression.text : ts.isPropertyAccessExpression(current.expression) ? current.expression.name.text : "";
      if (classCalls.has(callee)) return true;
    }
    if (ts.isStatement(current)) return false;
    current = current.parent;
  }
  return false;
};

let files = 0, replacementsCount = 0;
for (const path of tracked) {
  if (!config.roots.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
  const absolute = resolve(root, path);
  let text = readFileSync(absolute, "utf8");
  if (/\.(?:[cm]?[jt]sx?)$/.test(path)) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const replacements = [];
    const visit = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        const start = node.getStart(source), end = node.end;
        const raw = text.slice(start, end), next = logicalClasses(raw);
        if (next !== raw) replacements.push({ start, end, value: next });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) text = text.slice(0, replacement.start) + replacement.value + text.slice(replacement.end);
    if (replacements.length) {
      const parsed = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      if (parsed.parseDiagnostics.length) throw new Error(`${path}: ${parsed.parseDiagnostics.map((item) => item.messageText).join("; ")}`);
      replacementsCount += replacements.length;
    }
  } else if (/\.(?:css|scss)$/.test(path)) {
    const before = text;
    text = text
      .replace(/\bmargin-left\s*:/g, "margin-inline-start:").replace(/\bmargin-right\s*:/g, "margin-inline-end:")
      .replace(/\bpadding-left\s*:/g, "padding-inline-start:").replace(/\bpadding-right\s*:/g, "padding-inline-end:")
      .replace(/\bborder-left\s*:/g, "border-inline-start:").replace(/\bborder-right\s*:/g, "border-inline-end:")
      .replace(/\bborder-top-left-radius\s*:/g, "border-start-start-radius:").replace(/\bborder-top-right-radius\s*:/g, "border-start-end-radius:")
      .replace(/\bborder-bottom-left-radius\s*:/g, "border-end-start-radius:").replace(/\bborder-bottom-right-radius\s*:/g, "border-end-end-radius:")
      .replace(/\bleft\s*:/g, "inset-inline-start:").replace(/\bright\s*:/g, "inset-inline-end:")
      .replace(/text-align\s*:\s*left\b/g, "text-align: start").replace(/text-align\s*:\s*right\b/g, "text-align: end")
      .replace(/float\s*:\s*left\b/g, "float: inline-start").replace(/float\s*:\s*right\b/g, "float: inline-end");
    if (text !== before) replacementsCount += 1;
  } else continue;
  if (text !== readFileSync(absolute, "utf8")) { writeFileSync(absolute, text); files += 1; }
}
console.log(JSON.stringify({ files, replacements: replacementsCount }));
