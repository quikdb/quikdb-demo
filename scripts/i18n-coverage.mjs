#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const config = JSON.parse(readFileSync(resolve(root, "i18n/coverage.config.json"), "utf8"));
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const catalogues = new Map(), rows = [], seen = new Set();
const uiProperties = new Set(["label", "title", "description", "message", "caption", "heading", "emptyText"]);
const uiCalls = new Set(["alert", "confirm", "setError"]);
const uiAttributes = new Set(["aria-label", "aria-description", "alt", "placeholder", "title"]);
const clean = (value) => value.replace(/\s+/g, " ").trim();
const visible = (value) => /[A-Za-z\u0600-\u06ff]/.test(value) && value.length > 1;
const flatten = (value, prefix = "") => {
  if (typeof value === "string") catalogues.set(prefix, value);
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key);
};
for (const file of config.catalogues) flatten(JSON.parse(readFileSync(resolve(root, file), "utf8")));
const add = (row) => {
  const signature = `${row.path}\0${row.line}\0${row.kind}\0${row.englishSource}\0${row.key ?? ""}`;
  if (!seen.has(signature)) { seen.add(signature); rows.push(row); }
};
const attrsOf = (node) => node?.attributes?.properties ?? [];
const attrValue = (node, name) => {
  const attr = attrsOf(node).find((item) => ts.isJsxAttribute(item) && item.name.text === name);
  return attr && attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : undefined;
};
const openingFor = (node) => {
  let current = node;
  while (current) {
    if (ts.isJsxElement(current)) return current.openingElement;
    if (ts.isJsxSelfClosingElement(current)) return current;
    current = current.parent;
  }
};
const boundary = (node) => {
  let current = node;
  while (current) {
    const opening = openingFor(current);
    const content = attrValue(opening, "data-i18n-content");
    if (content) return { disposition: "excluded-authored-content", evidence: content };
    const skip = attrValue(opening, "data-i18n-skip");
    if (skip) return { disposition: `excluded-${skip}`, evidence: `explicit data-i18n-skip=${skip}` };
    current = current.parent;
  }
  return null;
};
const position = (source, node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
const literalRow = (source, path, node, kind, raw) => {
  const englishSource = clean(raw);
  if (!visible(englishSource)) return;
  const exclusion = boundary(node);
  add({ path, line: position(source, node), kind, englishSource, disposition: exclusion?.disposition ?? "unowned", evidence: exclusion?.evidence ?? "source literal does not reference a runtime catalogue key" });
};
const keyRow = (source, path, node, key, kind) => {
  const englishSource = catalogues.get(key);
  add({ path, line: position(source, node), kind, key, englishSource: englishSource ?? "", disposition: englishSource ? "catalogue-reference" : "missing-key", evidence: englishSource ? "stable key resolved in committed English catalogue" : "runtime key is absent from committed English catalogue" });
};

for (const path of tracked) {
  if (!config.roots.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
  if ((config.excludePrefixes ?? []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
  if (/\.mdx?$/.test(path)) {
    readFileSync(resolve(root, path), "utf8").split(/\r?\n/).forEach((line, index) => {
      const prose = clean(line.replace(/^\s{0,3}(?:#{1,6}|[-*+] |\d+\. |> |\|)\s*/, ""));
      if (visible(prose) && !/^\s*(?:```|---|import |export |<[^>]+>)\s*$/.test(line)) add({ path, line: index + 1, kind: "authored-prose", englishSource: prose, disposition: "excluded-authored-content", evidence: "explicit Markdown/MDX content row; translation-review owned" });
    });
    continue;
  }
  if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
  const text = readFileSync(resolve(root, path), "utf8");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const translatorBindings = new Map();
  const translationHooks = new Map();
  const localeHooks = new Set();
  const serverTranslators = new Set();
  const i18nTextComponents = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    const imports = statement.importClause?.namedBindings;
    if (!imports || !ts.isNamedImports(imports)) continue;
    for (const element of imports.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      const local = element.name.text;
      if (moduleName === "next-intl" && imported === "useTranslations") translationHooks.set(local, "client");
      if (moduleName === "next-intl/server" && imported === "getTranslations") translationHooks.set(local, "server");
      if (/i18n\/LocaleProvider$/.test(moduleName) && imported === "useLocale") localeHooks.add(local);
      if (/i18n\/(?:runtime|server)$/.test(moduleName) && imported === "translate") serverTranslators.add(local);
      if (/i18n\/I18nText$/.test(moduleName) && imported === "I18nText") i18nTextComponents.add(local);
    }
  }
  const collectTranslators = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = ts.isAwaitExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isCallExpression(initializer)) {
        const callee = initializer.expression;
        const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
        const namespace = initializer.arguments[0];
        if (ts.isIdentifier(node.name) && translationHooks.has(name)) translatorBindings.set(node.name.text, namespace && ts.isStringLiteral(namespace) ? namespace.text : "");
        if (ts.isObjectBindingPattern(node.name) && localeHooks.has(name)) {
          for (const element of node.name.elements) {
            const sourceName = element.propertyName?.getText(source) ?? element.name.getText(source);
            if (sourceName === "t" && ts.isIdentifier(element.name)) translatorBindings.set(element.name.text, "");
          }
        }
      }
    }
    ts.forEachChild(node, collectTranslators);
  };
  collectTranslators(source);
  const visit = (node) => {
    if (ts.isJsxText(node)) literalRow(source, path, node, "jsx-text", node.text);
    if (ts.isJsxAttribute(node) && uiAttributes.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) literalRow(source, path, node, "a11y-or-attribute", node.initializer.text);
    if (ts.isPropertyAssignment(node) && uiProperties.has(node.name.text) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) literalRow(source, path, node, "ui-model", node.initializer.text);
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      const serverTranslate = serverTranslators.has(name) && (config.serverTranslationFiles ?? []).includes(path);
      const arg = translatorBindings.has(name) ? node.arguments[0] : serverTranslate ? node.arguments[1] : undefined;
      if ((translatorBindings.has(name) || serverTranslate) && arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
        const namespace = translatorBindings.get(name);
        keyRow(source, path, node, namespace ? `${namespace}.${arg.text}` : arg.text, "runtime-key");
      }
      else if (uiCalls.has(name) || (ts.isPropertyAccessExpression(callee) && callee.expression.getText(source) === "toast")) {
        const feedback = node.arguments[0];
        if (feedback && (ts.isStringLiteral(feedback) || ts.isNoSubstitutionTemplateLiteral(feedback))) literalRow(source, path, node, "feedback", feedback.text);
      }
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && i18nTextComponents.has(node.tagName.getText(source))) {
      const key = attrValue(node, "id");
      if (key) keyRow(source, path, node, key, "runtime-component-key");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
rows.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.kind.localeCompare(b.kind));
const counts = rows.reduce((result, row) => ({ ...result, [row.disposition]: (result[row.disposition] ?? 0) + 1 }), {});
const manifest = { schemaVersion: 3, repository: config.repository, activeRoutes: config.activeRoutes, excludedRouteEvidence: config.excludedRouteEvidence ?? {}, counts: { total: rows.length, ...counts, unowned: (counts.unowned ?? 0) + (counts["missing-key"] ?? 0) }, policy: { catalogue: "Only useLocale().t, namespaced next-intl useTranslations/getTranslations, request-locale translate(locale,key), or I18nText context-consumer references count as migrated.", authoredContent: "Only explicit data-i18n-content nodes and Markdown/MDX prose rows may be content-review exclusions.", skippedRuntimeData: "User content and technical identifiers require an explicit data-i18n-skip boundary; broad customer-route exclusions are forbidden." }, rows };
if (process.argv.includes("--emit")) process.stdout.write(JSON.stringify(manifest));
else {
  const committed = JSON.parse(readFileSync(resolve(root, config.manifest), "utf8"));
  if (JSON.stringify(committed) !== JSON.stringify(manifest)) throw new Error("Committed coverage manifest is stale.");
  if (manifest.counts.unowned > 0) throw new Error(`${manifest.counts.unowned} active-route UI strings are unowned or reference missing keys.`);
  console.log(JSON.stringify(manifest.counts));
}
