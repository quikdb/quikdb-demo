import en from "./en.json"; import ar from "./ar.review.json"; import type { Locale } from "./config";
const sources: Record<Locale, Record<string, string>> = { en, ar };
export const t = (locale: Locale, key: string, values: Record<string, string | number> = {}) =>
  (sources[locale][key] ?? en[key as keyof typeof en] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
