import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const mode = process.env.I18N_TEST_MODE ?? "review";
const baseURL = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4173";
const pagePath = process.env.VISUAL_PATH ?? "/";
const selector = process.env.VISUAL_SELECTOR ?? "select";
await mkdir("artifacts/i18n", { recursive: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const assertBoundary = async (page, locale, label) => {
  const state = await page.locator("html").evaluate((html) => ({ lang: html.lang, dir: html.dir, overflow: html.scrollWidth - html.clientWidth }));
  assert(state.lang === locale, `${label}: expected lang=${locale}; ${JSON.stringify(state)}`);
  assert(state.dir === (locale === "ar" ? "rtl" : "ltr"), `${label}: wrong direction; ${JSON.stringify(state)}`);
  assert(state.overflow <= 1, `${label}: horizontal overflow ${state.overflow}px`);
};

const browser = await chromium.launch({ headless: true });
if (mode === "review") {
  const ssrContext = await browser.newContext();
  await ssrContext.addCookies([{ name: "quikdb.locale", value: "ar", domain: "127.0.0.1", path: "/" }]);
  const response = await ssrContext.request.get(new URL(pagePath, baseURL).toString());
  const renderedHtml = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert(renderedHtml.includes("⟦headline⟧"), "Arabic request SSR did not render the catalogue probe");
  assert(!renderedHtml.includes("THIS JOB HAS BEEN RUNNING ALL DAY"), "Arabic request SSR retained the original literal");
  await ssrContext.close();
}
for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  const context = await browser.newContext({ locale: mode === "release" ? "ar-QA" : "en", viewport });
  if (mode === "release") await context.addCookies([{ name: "quikdb.locale", value: "ar", domain: "127.0.0.1", path: "/" }]);
  const page = await context.newPage();
  await page.goto(new URL(pagePath, baseURL).toString(), { waitUntil: "networkidle" });
  const select = page.locator(selector);
  if (mode === "release") {
    await assertBoundary(page, "en", `${viewport.name} release gate`);
    assert(await select.locator("option[value=ar]").isDisabled(), `${viewport.name}: Arabic release option is enabled`);
    await context.close();
    continue;
  }
  await assertBoundary(page, "en", `${viewport.name} initial`);
  await select.selectOption("ar");
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  await assertBoundary(page, "ar", `${viewport.name} EN-to-AR`);
  assert((await page.locator("body").innerText()).includes("⟦headline⟧"), `${viewport.name}: active route did not render the CI catalogue probe`);
  assert(!(await page.locator("body").innerText()).includes("THIS JOB HAS BEEN RUNNING ALL DAY"), `${viewport.name}: original literal survived instead of the catalogue probe`);
  assert((await context.cookies()).some((cookie) => cookie.name === "quikdb.locale" && cookie.value === "ar"), `${viewport.name}: explicit cookie missing`);
  assert(await page.evaluate(() => localStorage.getItem("quikdb.locale.explicit")) === "ar", `${viewport.name}: explicit localStorage missing`);
  assert(!/(?:^|\s)(?:meta|locale|stats|feed|challenge|nodes|always)\.[A-Za-z]/m.test(await page.locator("body").innerText()), `${viewport.name}: raw translation key rendered`);
  await page.reload({ waitUntil: "networkidle" });
  await assertBoundary(page, "ar", `${viewport.name} persisted reload`);
  assert(await select.inputValue() === "ar", `${viewport.name}: switcher did not hydrate persisted Arabic`);
  await select.focus();
  assert(await page.evaluate((id) => document.activeElement?.id === id, selector.slice(1)), `${viewport.name}: switcher is not keyboard focusable`);
  await select.press("Home");
  await page.waitForFunction(() => document.documentElement.dir === "ltr");
  await assertBoundary(page, "en", `${viewport.name} keyboard AR-to-EN`);
  await select.selectOption("ar");
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  await page.screenshot({ path: `artifacts/i18n/review-${viewport.name}-ar.png`, fullPage: true });
  await context.close();
}
await browser.close();
