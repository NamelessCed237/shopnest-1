import type { Money, PlanCode } from '@shopnest/contracts'
import { PLAN_LIMITS, addMoney, applyRate, money, multiplyMoney } from '@shopnest/contracts'

/**
 * Fonctions pures — testables sans React, réutilisées par le backend pour recalculer
 * le total côté serveur (on ne fait JAMAIS confiance au total envoyé par le client).
 */

export interface CartLine {
  productId: string
  categoryId: string
  unitPrice: Money
  quantity: number
}

export interface CartTotals {
  subtotal: Money
  discount: Money
  total: Money
}

/**
 * doc/02 §1.1 — version explicite plutôt que « maligne ».
 * doc/02 §2.3 — les remises sont indexées par Map : un `find` par ligne serait O(n × m).
 */
export function computeCartTotals(
  lines: readonly CartLine[],
  discountRateByCategory: ReadonlyMap<string, number> = new Map(),
  currency = 'EUR',
): CartTotals {
  let subtotal = money(0, currency)
  let discount = money(0, currency)

  for (const line of lines) {
    const lineTotal = multiplyMoney(line.unitPrice, line.quantity)
    subtotal = addMoney(subtotal, lineTotal)

    const rate = discountRateByCategory.get(line.categoryId) ?? 0
    if (rate > 0) discount = addMoney(discount, applyRate(lineTotal, rate))
  }

  return {
    subtotal,
    discount,
    total: money(subtotal.amountCents - discount.amountCents, currency),
  }
}

/** Commission ShopNest — le taux vient de PLAN_LIMITS, source unique (doc/02 §1.2). */
export function computePlatformFee(orderTotal: Money, plan: PlanCode): Money {
  const rate = PLAN_LIMITS[plan].transactionFeeRate
  // Enterprise : taux négocié, calculé en amont et stocké sur le tenant.
  if (rate === null) return money(0, orderTotal.currency)
  return applyRate(orderTotal, rate)
}
