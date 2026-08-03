import { describe, expect, it } from 'vitest'
import { formatMoney, minorUnitsPerMajor } from './index.js'

/** Une erreur d'un facteur 100 sur un prix est un incident de facturation, pas un défaut d'affichage. */
describe('formatMoney', () => {
  it('utilise 2 décimales pour une devise à 2 décimales', () => {
    const out = formatMoney({ amountCents: 4500, currency: 'EUR' })
    expect(out).toContain('45')
    expect(out).not.toContain('4 500')
  })

  it('n’applique AUCUNE division pour le XAF (devise sans décimale)', () => {
    // 45 000 unités mineures de XAF = 45 000 FCFA, surtout pas 450.
    const out = formatMoney({ amountCents: 45_000, currency: 'XAF' })
    const digitsOnly = out.replace(/\D/g, '')
    expect(digitsOnly).toBe('45000')
  })

  it('traite le XOF comme le XAF', () => {
    expect(formatMoney({ amountCents: 1_000, currency: 'XOF' }).replace(/\D/g, '')).toBe('1000')
  })

  it('gère une devise à 3 décimales (KWD)', () => {
    expect(formatMoney({ amountCents: 1_500, currency: 'KWD' }).replace(/\D/g, '')).toBe('1500')
  })
})

describe('minorUnitsPerMajor', () => {
  it('renvoie 100 pour EUR et 1 pour XAF', () => {
    expect(minorUnitsPerMajor('EUR')).toBe(100)
    expect(minorUnitsPerMajor('XAF')).toBe(1)
  })
})
