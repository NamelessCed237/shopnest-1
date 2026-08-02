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
 * Formatage monétaire — JAMAIS de concaténation manuelle avec un symbole.
 * Les montants sont des entiers de centimes (doc/03 §4).
 */
export function formatMoney(money: Money, locale: Locale = 'fr'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(money.amountCents / 100)
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
