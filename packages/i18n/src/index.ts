import type { Money } from '@shopnest/contracts'
import { fr } from './locales/fr.js'
import { en } from './locales/en.js'

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const catalogs: Record<Locale, Record<string, string>> = { fr, en }

/**
 * doc/04 §10 — aucune chaîne visible en dur. Les clés d'erreur renvoyées par l'API
 * (AppError.userMessageKey) se résolvent dans ce même catalogue.
 */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>) {
  const template = catalogs[locale][key] ?? catalogs.fr[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

/**
 * Pluriel — résout `<clé>_one` ou `<clé>_other` selon `count`.
 *
 * Écrire « 1 restant(s) » ou « 1 restants » est un défaut visible dans toutes les
 * listes. Les règles de pluriel varient par langue (le français met 0 au
 * singulier, l'anglais au pluriel), donc on délègue à `Intl.PluralRules` plutôt
 * que de tester `count > 1`.
 */
export function translatePlural(
  locale: Locale,
  key: string,
  count: number,
  vars?: Record<string, string | number>,
) {
  const category = new Intl.PluralRules(locale).select(count)
  const suffixed = `${key}_${category}`
  const fallback = `${key}_other`
  const template =
    catalogs[locale][suffixed] ?? catalogs[locale][fallback] ?? catalogs.fr[fallback] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name === 'count' ? formatNumber(count, locale) : String(vars?.[name] ?? `{${name}}`),
  )
}

/**
 * Formatage monétaire — JAMAIS de concaténation manuelle avec un symbole.
 *
 * `amountCents` est un entier d'UNITÉS MINEURES, et leur nombre de décimales
 * dépend de la devise : 2 pour EUR, mais **0 pour XAF, XOF, JPY** et 3 pour
 * KWD ou TND. Diviser systématiquement par 100 afficherait 450 FCFA au lieu de
 * 45 000 — une erreur d'un facteur 100 sur tous les marchés d'Afrique centrale
 * et de l'Ouest, qui sont précisément ceux que la plateforme vise.
 *
 * Le nombre de décimales est demandé à Intl plutôt que codé en dur : la table
 * ISO 4217 n'a pas à être maintenue à la main.
 */
export function formatMoney(money: Money, locale: Locale = 'fr'): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(money.amountCents / 10 ** digits)
}

/**
 * Montant ABRÉGÉ — « 25 M FCFA » au lieu de « 25 000 000 FCFA ».
 *
 * Destiné aux axes de graphique et aux espaces contraints, jamais à un montant
 * qu'on lit pour le vérifier : un total de facture s'écrit en entier.
 *
 * Sans lui, l'axe d'un graphique en francs CFA affiche « 10 000 000 FCFA », et
 * la gouttière ne peut pas suivre : l'étiquette se retrouve rognée en
 * « 000 000 ». Le problème est pire dans les devises SANS décimales — les
 * marchés d'Afrique centrale et de l'Ouest — où les montants comptent trois
 * chiffres de plus qu'en euros pour la même valeur.
 *
 * `compactDisplay: 'short'` et une seule décimale significative : « 1,2 M »
 * reste lisible là où « 1,25 M » rallonge sans rien apprendre à cette échelle.
 */
export function formatMoneyCompact(money: Money, locale: Locale = 'fr'): string {
  const digits = Math.log10(minorUnitsPerMajor(money.currency, locale))
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(money.amountCents / 10 ** digits)
}

/** Nombre d'unités mineures par unité majeure — 100 pour EUR, 1 pour XAF. */
export function minorUnitsPerMajor(currency: string, locale: Locale = 'fr'): number {
  const digits =
    new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  return 10 ** digits
}

/** L'API renvoie toujours de l'UTC ISO 8601 ; la conversion locale se fait à l'affichage. */
export function formatDate(iso: string, locale: Locale = 'fr'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

export function formatDateTime(iso: string, locale: Locale = 'fr'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export function formatRelativeTime(iso: string, locale: Locale = 'fr'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }
  return rtf.format(0, 'minute')
}

export function formatNumber(value: number, locale: Locale = 'fr'): string {
  return new Intl.NumberFormat(locale).format(value)
}
