import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { Money } from '@shopnest/contracts'
import { formatDate, formatMoney, formatNumber, translate, type Locale } from './index.js'

/**
 * Liaison React de @shopnest/i18n — utilisable telle quelle sur web ET mobile
 * (React Context fonctionne sur les deux plateformes, aucun DOM ici).
 */

interface I18nValue {
  locale: Locale
  t: (key: string, vars?: Record<string, string | number>) => string
  money: (value: Money) => string
  date: (iso: string) => string
  number: (value: number) => string
}

const I18nContext = createContext<I18nValue | undefined>(undefined)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t,
      money: (v) => formatMoney(v, locale),
      date: (iso) => formatDate(iso, locale),
      number: (v) => formatNumber(v, locale),
    }),
    [locale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useTranslation doit être utilisé dans un <I18nProvider>')
  return value
}
