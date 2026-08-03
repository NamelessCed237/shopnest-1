import { describe, expect, it } from 'vitest'
import { derivePrice, deriveStock } from '@shopnest/contracts'
import { fakeProductMutations, fakeVariantMutations } from './fake-api'
import { fakeTenant } from './fixtures'

/**
 * doc/08 §4 — le stock est la donnée dont l'erreur coûte le plus cher :
 * vendre un article qu'on n'a plus. Les valeurs dérivées sont donc testées,
 * pas seulement documentées.
 */

const currency = fakeTenant.defaultCurrency
const uniq = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

async function makeProduct() {
  return fakeProductMutations.create({
    slug: uniq('prod'),
    name: 'Produit à variantes',
    description: '',
    price: { amountCents: 10_000, currency },
    status: 'draft',
    stock: 7,
    lowStockThreshold: 5,
    imageUrls: [],
    categoryIds: [],
  })
}

const variant = (overrides: Record<string, unknown> = {}) => ({
  sku: uniq('SKU'),
  name: 'Variante',
  price: { amountCents: 5_000, currency },
  stock: 3,
  attributes: {},
  ...overrides,
})

describe('valeurs dérivées', () => {
  it('remplace le stock du produit par la SOMME des variantes', async () => {
    const product = await makeProduct()
    expect(product.stock).toBe(7)

    const withOne = await fakeVariantMutations.addVariant(product.id, variant({ stock: 4 }))
    expect(withOne.stock).toBe(4)

    const withTwo = await fakeVariantMutations.addVariant(product.id, variant({ stock: 6 }))
    // 4 + 6 = 10, et surtout PAS 7 + 10 : le stock produit initial est remplacé,
    // pas additionné, sinon on afficherait du stock qui n'existe pas.
    expect(withTwo.stock).toBe(10)
  })

  it('affiche le prix le PLUS BAS des variantes', async () => {
    const product = await makeProduct()
    await fakeVariantMutations.addVariant(product.id, variant({ price: { amountCents: 9_000, currency } }))
    const updated = await fakeVariantMutations.addVariant(
      product.id,
      variant({ price: { amountCents: 3_500, currency } }),
    )
    expect(updated.price.amountCents).toBe(3_500)
  })

  it('recalcule après modification d’une variante', async () => {
    const product = await makeProduct()
    const withVariant = await fakeVariantMutations.addVariant(product.id, variant({ stock: 2 }))
    const variantId = withVariant.variants[0]!.id

    const updated = await fakeVariantMutations.updateVariant(product.id, variantId, { stock: 50 })
    expect(updated.stock).toBe(50)
  })

  it('rend au produit son stock propre quand la DERNIÈRE variante disparaît', async () => {
    const product = await makeProduct()
    const withVariant = await fakeVariantMutations.addVariant(product.id, variant({ stock: 12 }))
    const variantId = withVariant.variants[0]!.id

    const afterRemoval = await fakeVariantMutations.removeVariant(product.id, variantId)
    expect(afterRemoval.variants).toHaveLength(0)
    // On conserve les valeurs de la variante retirée : remettre zéro laisserait
    // un produit vendable à 0 F que le vendeur corrigerait sans y penser.
    expect(afterRemoval.stock).toBe(12)
  })
})

describe('garde-fou de mise a jour', () => {
  it('ignore un stock envoyé par le client quand des variantes existent', async () => {
    const product = await makeProduct()
    await fakeVariantMutations.addVariant(product.id, variant({ stock: 3 }))

    // Simule un formulaire ouvert AVANT l'ajout de la variante, qui renvoie
    // l'ancien stock produit : le serveur doit le recalculer, pas l'accepter.
    const updated = await fakeProductMutations.update(product.id, { stock: 999 })
    expect(updated.stock).toBe(3)
  })
})

describe('SKU', () => {
  it('refuse un SKU déjà utilisé par un AUTRE produit', async () => {
    const first = await makeProduct()
    const second = await makeProduct()

    const sku = uniq('SHARED')
    await fakeVariantMutations.addVariant(first.id, variant({ sku }))

    // Unicité à l'échelle du tenant : un SKU sert en entrepôt, où le produit
    // parent n'apparaît pas.
    await expect(
      fakeVariantMutations.addVariant(second.id, variant({ sku })),
    ).rejects.toMatchObject({ code: 'CONFLICT', fields: { sku: 'errors.variant.skuTaken' } })
  })

  it('autorise une variante à conserver son propre SKU', async () => {
    const product = await makeProduct()
    const created = await fakeVariantMutations.addVariant(product.id, variant())
    const existing = created.variants[0]!

    const updated = await fakeVariantMutations.updateVariant(product.id, existing.id, {
      sku: existing.sku,
      name: 'Renommée',
    })
    expect(updated.variants[0]?.name).toBe('Renommée')
  })
})

describe('helpers du contrat', () => {
  it('retombe sur les valeurs produit sans variante', () => {
    const fallbackPrice = { amountCents: 999, currency }
    expect(deriveStock([], 42)).toBe(42)
    expect(derivePrice([], fallbackPrice)).toBe(fallbackPrice)
  })
})
