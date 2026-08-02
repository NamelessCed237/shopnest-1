import { describe, expect, it } from 'vitest'
import { PLAN_CODES, PLAN_LIMITS, planAllows } from './plan.contract.js'

/**
 * PLAN_LIMITS est la source de vérité unique des limites (doc/02 §1.2).
 * Ces tests verrouillent le contrat : une modification accidentelle des taux
 * ou des quotas casse ici, pas en production sur une facture client.
 */
describe('PLAN_LIMITS', () => {
  it('couvre tous les codes de plan', () => {
    for (const code of PLAN_CODES) expect(PLAN_LIMITS[code]).toBeDefined()
  })

  it('applique des quotas croissants du plan le plus bas au plus haut', () => {
    expect(PLAN_LIMITS.basic.maxProducts).toBeLessThan(PLAN_LIMITS.pro.maxProducts)
    expect(PLAN_LIMITS.pro.maxProducts).toBeLessThan(PLAN_LIMITS.enterprise.maxProducts)
  })

  it('applique des frais de transaction décroissants', () => {
    expect(PLAN_LIMITS.pro.transactionFeeRate).toBeLessThan(PLAN_LIMITS.basic.transactionFeeRate)
    // Enterprise est négocié : pas de taux par défaut.
    expect(PLAN_LIMITS.enterprise.transactionFeeRate).toBeNull()
  })
})

describe('planAllows', () => {
  it('réserve le domaine personnalisé aux plans Pro et Enterprise', () => {
    expect(planAllows('basic', 'customDomain')).toBe(false)
    expect(planAllows('pro', 'customDomain')).toBe(true)
    expect(planAllows('enterprise', 'customDomain')).toBe(true)
  })

  it('réserve le virement bancaire à Enterprise', () => {
    expect(planAllows('pro', 'bankTransfer')).toBe(false)
    expect(planAllows('enterprise', 'bankTransfer')).toBe(true)
  })

  it('renvoie false pour une fonctionnalité non encore rattachée à un plan', () => {
    expect(planAllows('enterprise', 'multiCurrency')).toBe(false)
  })
})
