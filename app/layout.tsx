import type { Metadata } from 'next'
import Script from 'next/script'
import { headers } from 'next/headers'
import './globals.css'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { arabicEnabled, defaultLocale, direction, isLocale } from '@/i18n/config'
import { t } from '@/i18n/runtime'

async function requestLocale() { const value = (await headers()).get('x-quikdb-locale'); return isLocale(value) ? value : defaultLocale }
export async function generateMetadata(): Promise<Metadata> { const locale = await requestLocale(); return { title: t(locale, 'meta.title'), description: t(locale, 'meta.description') } }

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await requestLocale()
  const allowArabic = arabicEnabled()
  return (
    <html lang={locale} dir={direction(locale)}>
      <body>
        <LocaleProvider initialLocale={locale} arabicEnabled={allowArabic} coverageProbe={process.env.I18N_COVERAGE_PROBE === "true"}>{children}<LocaleSwitcher arabicEnabled={allowArabic} /></LocaleProvider>
        <Script
          id="hs-script-loader"
          src="https://js-eu1.hs-scripts.com/149469290.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
