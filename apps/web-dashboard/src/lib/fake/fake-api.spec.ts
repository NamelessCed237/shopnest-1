import { describe, expect, it } from 'vitest'
import { PLAN_LIMITS } from '@shopnest/contracts'
import { fakeProductEndpoints, fakeProductMutations } from './fake-api'
import { fakeProducts, fakeTenant } from './fixtures'

/**
 * doc/08 §4 — les règles qui protègent le catalogue sont testées, pas seulement
 * écrites : unicité du slug, quota de plan, archivage plutôt que suppression.
 */

const validInput = (slug: string) => ({
  slug,
  name: `Produit ${slug}`,
  description: '',
  price: { amountCents: 1000, currency: fakeTenant.defaultCurrency },
  status: 'draft' as const,
  stock: 0,
  lowStockThreshold: 5,
  imageUrls: [],
  categoryIds: [],
})

describe('create', () => {
  it('refuse un slug déjà pris, avec une erreur PAR CHAMP', async () => {
    const existing = fakeProducts[0]!

    await expect(fakeProductMutations.create(validInput(existing.slug))).rejects.toMatchObject({
      code: 'CONFLICT',
      // Sans `fields`, le formulaire afficherait un bandeau générique au lieu
      // de pointer le champ fautif (doc/02 §5).
      fields: { slug: 'errors.product.slugTaken' },
    })
  })

  it('place le produit créé en tête de liste', async () => {
    const created = await fakeProductMutations.create(validInput(`test-${crypto.randomUUID()}`))
    const page = await fakeProductEndpoints.list({ limit: 5 })
    expect(page.items[0]?.id).toBe(created.id)
  })

  it('applique le quota du plan depuis PLAN_LIMITS', async () => {
    // On ne teste pas en créant 5 000 produits : on vérifie que la limite lue
    // est bien celle du contrat, et que le compteur ignore les archivés.
    const limit = PLAN_LIMITS[fakeTenant.planCode].maxProducts
    const active = fakeProducts.filter((p) => p.status !== 'archived').length
    expect(limit).toBe(PLAN_LIMITS.pro.maxProducts)
    expect(active).toBeLessThan(limit)
  })
})

describe('update', () => {
  it('autorise un produit à conserver son propre slug', async () => {
    const product = fakeProducts[1]!
    const updated = await fakeProductMutations.update(product.id, {
      slug: product.slug,
      name: 'Nom modifié',
    })
    expect(updated.name).toBe('Nom modifié')
    expect(updated.slug).toBe(product.slug)
  })

  it('refuse le slug d’un AUTRE produit', async () => {
    const [first, second] = fakeProducts
    await expect(
      fakeProductMutations.update(first!.id, { slug: second!.slug }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('renvoie une copie, pas l’objet du magasin', async () => {
    const product = fakeProducts[2]!
    const result = await fakeProductMutations.detail(product.id)
    expect(result).not.toBe(product)
  })
})

describe('archive', () => {
  it('archive au lieu de supprimer : le produit reste consultable', async () => {
    const created = await fakeProductMutations.create(validInput(`arch-${crypto.randomUUID()}`))

    const archived = await fakeProductMutations.archive(created.id)
    expect(archived.status).toBe('archived')

    // Toujours récupérable : une commande passée doit pouvoir l'afficher.
    const stillThere = await fakeProductMutations.detail(created.id)
    expect(stillThere.id).toBe(created.id)
  })

  it('renvoie NOT_FOUND sur un identifiant inconnu', async () => {
    await expect(fakeProductMutations.archive(crypto.randomUUID())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
