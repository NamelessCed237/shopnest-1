import { z } from 'zod'

/**
 * doc/03 §4 — les montants sont TOUJOURS des entiers de centimes.
 * Un `number` flottant pour de l'argent produit des écarts d'arrondi silencieux
 * qui deviennent des litiges de facturation.
 */
export const MoneySchema = z.object({
  amountCents: z.number().int(),
  currency: z.string().length(3).toUpperCase(),
})
export type Money = z.infer<typeof MoneySchema>

export const money = (amountCents: number, currency = 'EUR'): Money => ({ amountCents, currency })

export const ZERO = (currency = 'EUR'): Money => money(0, currency)

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amountCents + b.amountCents, a.currency)
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amountCents - b.amountCents, a.currency)
}

export function multiplyMoney(m: Money, factor: number): Money {
  return money(Math.round(m.amountCents * factor), m.currency)
}

/** Applique un taux (0.025 = 2,5 %) — utilisé pour les frais de transaction. */
export function applyRate(m: Money, rate: number): Money {
  return multiplyMoney(m, rate)
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}
