"use client";
import { useLocale } from "@/i18n/LocaleProvider";
export function LocaleSwitcher({ arabicEnabled }: { arabicEnabled: boolean }) { const { locale, setLocale, t } = useLocale(); return <div className="locale-switcher"><label htmlFor="demo-locale">{t("locale.label")}</label><select id="demo-locale" value={locale} onChange={(event) => setLocale(event.target.value as "en" | "ar")}><option value="en">{t("locale.english")}</option><option value="ar" disabled={!arabicEnabled}>{arabicEnabled ? t("locale.arabic") : t("locale.arabicPending")}</option></select></div>; }
