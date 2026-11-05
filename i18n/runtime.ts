import en from "./en.json"; import ar from "./ar.review.json"; import type { Locale } from "./config";
const sources: Record<Locale, Record<string, string>> = { en, ar };
const intlLocale = (locale: Locale) => locale === "ar" ? "ar-u-nu-arab" : locale;
export const t = (locale: Locale, key: string, values: Record<string, string | number> = {}) =>
  (locale === "ar" && (process.env.I18N_COVERAGE_PROBE === "true" || process.env.NEXT_PUBLIC_I18N_COVERAGE_PROBE === "true")
    ? `⟦${key}⟧`
    : sources[locale][key] ?? en[key as keyof typeof en] ?? key
  ).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
export const formatNumber = (locale: Locale, value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(intlLocale(locale), options).format(value);
export const formatDate = (locale: Locale, value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intlLocale(locale), options ?? { dateStyle: "medium" }).format(new Date(value));
export const formatCurrency = (locale: Locale, value: number, currency: string) =>
  new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(value);
