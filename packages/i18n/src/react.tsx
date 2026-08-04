import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Money } from '@shopnest/contracts'
import {
  LOCALES,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  translate,
  translatePlural,
  type Locale,
} from './index.js'

/**
 * Liaison React de @shopnest/i18n — utilisable telle quelle sur web ET mobile
 * (React Context fonctionne sur les deux plateformes, aucun DOM ici).
 */

const STORAGE_KEY = 'shopnest.locale'

interface I18nValue {
  locale: Locale
  /** Change la langue sans rechargement, et mémorise le choix. */
  setLocale: (locale: Locale) => void
  availableLocales: readonly Locale[]
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Pluriel : résout `<clé>_one` / `<clé>_other` selon `count`. */
  tp: (key: string, count: number, vars?: Record<string, string | number>) => string
  money: (value: Money) => string
  /** Montant abrégé — axes de graphique et espaces contraints. */
  moneyCompact: (value: Money) => string
  date: (iso: string) => string
  number: (value: number) => string
}

const I18nContext = createContext<I18nValue | undefined>(undefined)

export interface I18nProviderProps {
  children: ReactNode
  /** Langue de repli si rien n'est mémorisé et que celle du navigateur n'est pas gérée. */
  fallbackLocale?: Locale
  /**
   * Persistance. Fournie par l'app : le web utilise localStorage, le mobile
   * utilisera AsyncStorage — le package ne connaît ni l'un ni l'autre.
   */
  storage?: { get: () => string | null; set: (value: string) => void }
}

const isLocale = (value: string | null | undefined): value is Locale =>
  LOCALES.includes(value as Locale)

export function I18nProvider({
  children,
  fallbackLocale = 'fr',
  storage,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = storage?.get()
    if (isLocale(stored)) return stored
    // Choix mémorisé > langue du navigateur > repli.
    const navigatorLocale =
      typeof navigator === 'undefined' ? undefined : navigator.language.slice(0, 2)
    return isLocale(navigatorLocale) ? navigatorLocale : fallbackLocale
  })

  // `lang` sur <html> : indispensable aux lecteurs d'écran (prononciation) et
  // aux moteurs de recherche. L'oublier rend la page « anglaise » pour eux.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback(
    (next: Locale) => {
      storage?.set(next)
      setLocaleState(next)
    },
    [storage],
  )

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  const tp = useCallback(
    (key: string, count: number, vars?: Record<string, string | number>) =>
      translatePlural(locale, key, count, vars),
    [locale],
  )

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      availableLocales: LOCALES,
      t,
      tp,
      money: (v) => formatMoney(v, locale),
      moneyCompact: (v) => formatMoneyCompact(v, locale),
      date: (iso) => formatDate(iso, locale),
      number: (v) => formatNumber(v, locale),
    }),
    [locale, setLocale, t, tp],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useTranslation doit être utilisé dans un <I18nProvider>')
  return value
}

/** Adaptateur web prêt à l'emploi. */
export const localStorageAdapter = {
  get: () => localStorage.getItem(STORAGE_KEY),
  set: (value: string) => localStorage.setItem(STORAGE_KEY, value),
}
