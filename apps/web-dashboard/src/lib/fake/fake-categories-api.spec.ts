import { describe, expect, it } from 'vitest'
import { fakeCategoryCrudEndpoints } from './fake-categories-api'
import { fakeCategories } from './fixtures'

/**
 * doc/08 §4 — les règles qui protègent l'arborescence sont testées.
 *
 * Un cycle ou un 3ᵉ niveau ne se voient pas à l'écran : ils se manifestent
 * en production par un menu qui boucle ou un fil d'Ariane infini.
 */

const uniqueSlug = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

const newCategory = (overrides: Partial<Parameters<typeof fakeCategoryCrudEndpoints.create>[0]> = {}) => ({
  slug: uniqueSlug('cat'),
  name: 'Catégorie de test',
  description: '',
  position: 0,
  ...overrides,
})

describe('list', () => {
  it('ordonne chaque parent immédiatement suivi de ses enfants', async () => {
    const rows = await fakeCategoryCrudEndpoints.list()
    const audioIndex = rows.findIndex((c) => c.slug === 'audio')
    const casquesIndex = rows.findIndex((c) => c.slug === 'casques')

    expect(audioIndex).toBeGreaterThanOrEqual(0)
    // L'indentation de l'écran repose sur cet ordre : un enfant qui remonterait
    // avant son parent s'afficherait orphelin.
    expect(casquesIndex).toBeGreaterThan(audioIndex)
  })

  it('conserve le parent quand seul un enfant correspond à la recherche', async () => {
    const rows = await fakeCategoryCrudEndpoints.list({ search: 'casques' })
    expect(rows.map((c) => c.slug)).toContain('audio')
    expect(rows.map((c) => c.slug)).toContain('casques')
  })

  it('compte les produits rattachés directement', async () => {
    const rows = await fakeCategoryCrudEndpoints.list()
    const audio = rows.find((c) => c.slug === 'audio')
    expect(audio?.productCount).toBeGreaterThan(0)
    expect(audio?.childCount).toBe(2)
  })
})

describe('create / update', () => {
  it('refuse un slug déjà pris, avec une erreur par champ', async () => {
    await expect(fakeCategoryCrudEndpoints.create(newCategory({ slug: 'audio' }))).rejects.toMatchObject(
      { code: 'CONFLICT', fields: { slug: 'errors.category.slugTaken' } },
    )
  })

  it('refuse un troisième niveau', async () => {
    // « casques » est déjà un enfant : le prendre comme parent ferait 3 niveaux.
    await expect(
      fakeCategoryCrudEndpoints.create(newCategory({ parentId: 'c6' })),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { parentId: 'errors.category.tooDeep' } })
  })

  it('refuse qu’une catégorie devienne sa propre parente', async () => {
    await expect(
      fakeCategoryCrudEndpoints.update('c1', { parentId: 'c1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('refuse de rattacher une catégorie qui a déjà des enfants', async () => {
    // « Audio » (c1) a deux enfants : en faire un enfant de « Écrans » (c4)
    // pousserait ses propres enfants au 3ᵉ niveau.
    await expect(
      fakeCategoryCrudEndpoints.update('c1', { parentId: 'c4' }),
    ).rejects.toMatchObject({ fields: { parentId: 'errors.category.hasChildren' } })
  })

  it('accepte un rattachement valide à une racine', async () => {
    const created = await fakeCategoryCrudEndpoints.create(newCategory({ parentId: 'c4' }))
    expect(created.parentId).toBe('c4')
  })
})

describe('remove', () => {
  it('refuse de supprimer une catégorie contenant des produits', async () => {
    await expect(fakeCategoryCrudEndpoints.remove('c1')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('refuse de supprimer un parent ayant des sous-catégories', async () => {
    // « Périphériques » (c3) a des enfants ET des produits : on vérifie que le
    // message porte bien sur les sous-catégories, contrôlées en premier.
    await expect(fakeCategoryCrudEndpoints.remove('c3')).rejects.toMatchObject({
      userMessageKey: 'errors.category.hasChildrenDelete',
    })
  })

  it('supprime réellement une catégorie libre', async () => {
    const created = await fakeCategoryCrudEndpoints.create(newCategory())
    await fakeCategoryCrudEndpoints.remove(created.id)

    expect(fakeCategories.find((c) => c.id === created.id)).toBeUndefined()
    await expect(fakeCategoryCrudEndpoints.detail(created.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
