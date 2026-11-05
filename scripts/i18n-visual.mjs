import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4173";
const path = process.env.VISUAL_PATH ?? "/";
await mkdir("artifacts/i18n", { recursive: true });

for (const candidate of [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
]) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: candidate.viewport });
  await context.addCookies([{ name: "quikdb.locale", value: "ar", domain: "127.0.0.1", path: "/" }]);
  const page = await context.newPage();
  await page.goto(new URL(path, baseURL).toString(), { waitUntil: "networkidle" });
  const state = await page.locator("html").evaluate((html) => ({
    lang: html.lang,
    dir: html.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  if (state.lang !== "ar" || state.dir !== "rtl" || state.overflow > 1) {
    throw new Error(`${candidate.name} RTL assertion failed: ${JSON.stringify(state)}`);
  }
  await page.screenshot({ path: `artifacts/i18n/${candidate.name}-ar.png`, fullPage: true });
  await browser.close();
}
