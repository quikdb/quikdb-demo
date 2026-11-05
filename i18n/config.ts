export type Locale = "en" | "ar";
export const defaultLocale: Locale = "en";
export const localeCookie = "quikdb.locale";
export const localeSourceCookie = "quikdb.locale.source";
export const localeStorageKey = "quikdb.locale.explicit";
export const isLocale = (value: unknown): value is Locale => value === "en" || value === "ar";
export const direction = (locale: Locale) => locale === "ar" ? "rtl" : "ltr";
export const arabicEnabled = () => process.env.NEXT_PUBLIC_ARABIC_CATALOGUE_REVIEWED === "true" || process.env.I18N_ARABIC_REVIEW_MODE === "true";
