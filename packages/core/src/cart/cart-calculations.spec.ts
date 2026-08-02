import { describe, expect, it } from 'vitest'
import { money } from '@shopnest/contracts'
import { computeCartTotals, computePlatformFee, type CartLine } from './cart-calculations.js'

const line = (unitCents: number, quantity: number, categoryId = 'cat-1'): CartLine => ({
  productId: `p-${unitCents}`,
  categoryId,
  unitPrice: money(unitCents),
  quantity,
})

describe('computeCartTotals', () => {
  it('additionne les lignes en centiers entiers', () => {
    const totals = computeCartTotals([line(1999, 2), line(500, 3)])
    expect(totals.subtotal.amountCents).toBe(1999 * 2 + 500 * 3)
    expect(totals.total.amountCents).toBe(totals.subtotal.amountCents)
  })

  it('applique une remise par catégorie', () => {
    const discounts = new Map([['promo', 0.1]])
    const totals = computeCartTotals([line(1000, 1, 'promo'), line(1000, 1, 'plein')], discounts)
    expect(totals.discount.amountCents).toBe(100)
    expect(totals.total.amountCents).toBe(1900)
  })

  it('ne perd pas de centime sur un arrondi (pas de flottant)', () => {
    // 3 × 3,33 € avec 33 % de remise : le résultat doit rester un entier de centimes.
    const totals = computeCartTotals([line(333, 3, 'promo')], new Map([['promo', 0.33]]))
    expect(Number.isInteger(totals.discount.amountCents)).toBe(true)
    expect(Number.isInteger(totals.total.amountCents)).toBe(true)
  })

  it('renvoie zéro pour un panier vide', () => {
    expect(computeCartTotals([]).total.amountCents).toBe(0)
  })
})

describe('computePlatformFee', () => {
  it('applique le taux du plan, source unique PLAN_LIMITS', () => {
    expect(computePlatformFee(money(10_000), 'basic').amountCents).toBe(250) // 2,5 %
    expect(computePlatformFee(money(10_000), 'pro').amountCents).toBe(150) // 1,5 %
  })

  it('ne facture rien par défaut sur Enterprise (taux négocié)', () => {
    expect(computePlatformFee(money(10_000), 'enterprise').amountCents).toBe(0)
  })
})
