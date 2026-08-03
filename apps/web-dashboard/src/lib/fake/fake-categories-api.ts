import type {
  AppError,
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@shopnest/contracts'
import { MAX_CATEGORY_DEPTH, wouldCreateCycle } from '@shopnest/contracts'
import { normalizeForSearch } from '@shopnest/utils'
import { fakeCategories, fakeProducts } from './fixtures'

const LATENCY_MS = 400
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function fail(
  code: AppError['code'],
  userMessageKey: string,
  message: string,
  fields?: Record<string, string>,
): AppError {
  return {
    code,
    message: `[fake-api] ${message}`,
    userMessageKey,
    ...(fields ? { fields } : {}),
    traceId: crypto.randomUUID(),
  }
}

const snapshot = (category: Category): Category => ({ ...category })

const parentOf = (id: string): string | undefined =>
  fakeCategories.find((c) => c.id === id)?.parentId

/** Produits rattachés DIRECTEMENT — les sous-catégories comptent pour elles-mêmes. */
function countProducts(categoryId: string): number {
  return fakeProducts.filter(
    (product) => product.status !== 'archived' && product.categoryIds.includes(categoryId),
  ).length
}

function withCounts(category: Category): CategoryWithCounts {
  return {
    ...category,
    productCount: countProducts(category.id),
    childCount: fakeCategories.filter((c) => c.parentId === category.id).length,
  }
}

function assertSlugAvailable(slug: string, exceptId?: string): void {
  const clash = fakeCategories.find((c) => c.slug === slug && c.id !== exceptId)
  if (!clash) return
  throw fail('CONFLICT', 'errors.category.slugTaken', `slug ${slug} déjà pris`, {
    slug: 'errors.category.slugTaken',
  })
}

/**
 * Valide le rattachement à un parent.
 *
 * Trois règles, toutes appliquées CÔTÉ SERVEUR : le formulaire peut filtrer la
 * liste déroulante, mais un client modifié ne doit pas pouvoir corrompre
 * l'arborescence — un cycle ferait boucler tout parcours récursif (menu de la
 * boutique, fil d'Ariane, réindexation).
 */
function assertParentValid(categoryId: string | undefined, parentId: string | undefined): void {
  if (!parentId) return

  const parent = fakeCategories.find((c) => c.id === parentId)
  if (!parent) {
    throw fail('VALIDATION_FAILED', 'errors.category.parentNotFound', `parent ${parentId} inconnu`, {
      parentId: 'errors.category.parentNotFound',
    })
  }

  // Profondeur : un parent qui a déjà un parent ferait un 3ᵉ niveau.
  if (parent.parentId) {
    throw fail(
      'VALIDATION_FAILED',
      'errors.category.tooDeep',
      `profondeur > ${MAX_CATEGORY_DEPTH}`,
      { parentId: 'errors.category.tooDeep' },
    )
  }

  if (categoryId && wouldCreateCycle(categoryId, parentId, parentOf)) {
    throw fail('VALIDATION_FAILED', 'errors.category.cycle', 'cycle détecté', {
      parentId: 'errors.category.cycle',
    })
  }

  // Une catégorie qui a déjà des enfants ne peut pas devenir enfant elle-même :
  // ses propres enfants se retrouveraient au 3ᵉ niveau.
  if (categoryId && fakeCategories.some((c) => c.parentId === categoryId)) {
    throw fail('VALIDATION_FAILED', 'errors.category.hasChildren', 'a déjà des enfants', {
      parentId: 'errors.category.hasChildren',
    })
  }
}

export const fakeCategoryCrudEndpoints = {
  async list(
    query: { search?: string } = {},
    _options?: { signal?: AbortSignal },
  ): Promise<CategoryWithCounts[]> {
    await sleep(LATENCY_MS)

    const search = query.search ? normalizeForSearch(query.search) : undefined
    const matches = (category: Category) =>
      !search || normalizeForSearch(`${category.name} ${category.slug}`).includes(search)

    /*
     * Réponse APLATIE mais ORDONNÉE : chaque parent est immédiatement suivi de
     * ses enfants. Renvoyer un arbre imbriqué obligerait chaque client à le
     * reparcourir pour l'afficher, et casserait le tri d'un tableau.
     */
    const roots = fakeCategories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.position - b.position)

    const ordered: Category[] = []
    for (const root of roots) {
      const children = fakeCategories
        .filter((c) => c.parentId === root.id)
        .sort((a, b) => a.position - b.position)

      // Un parent est conservé si LUI ou l'un de ses enfants correspond :
      // masquer le parent rendrait les enfants orphelins à l'écran.
      const keptChildren = children.filter(matches)
      if (matches(root) || keptChildren.length > 0) {
        ordered.push(root, ...(matches(root) ? children : keptChildren))
      }
    }

    return ordered.map(withCounts)
  },

  async detail(categoryId: string, _options?: { signal?: AbortSignal }): Promise<CategoryWithCounts> {
    await sleep(LATENCY_MS / 2)
    const category = fakeCategories.find((c) => c.id === categoryId)
    if (!category) throw fail('NOT_FOUND', 'errors.notFound', `category ${categoryId} not found`)
    return withCounts(category)
  },

  async create(input: CreateCategoryInput): Promise<Category> {
    await sleep(LATENCY_MS)

    assertSlugAvailable(input.slug)
    assertParentValid(undefined, input.parentId)

    const category: Category = { ...input, id: crypto.randomUUID() }
    fakeCategories.push(category)
    return snapshot(category)
  },

  async update(categoryId: string, input: UpdateCategoryInput): Promise<Category> {
    await sleep(LATENCY_MS)

    const index = fakeCategories.findIndex((c) => c.id === categoryId)
    if (index === -1) throw fail('NOT_FOUND', 'errors.notFound', `category ${categoryId} not found`)

    if (input.slug) assertSlugAvailable(input.slug, categoryId)
    if ('parentId' in input) assertParentValid(categoryId, input.parentId)

    const updated: Category = { ...fakeCategories[index]!, ...input }
    fakeCategories[index] = updated
    return snapshot(updated)
  },

  /**
   * Suppression RÉELLE, contrairement aux produits.
   *
   * Une commande fige le nom et le prix du produit (doc/03 §4) mais ne
   * référence aucune catégorie : supprimer une catégorie ne peut donc pas
   * rendre un historique illisible. En revanche on refuse de le faire tant
   * qu'elle est utilisée, plutôt que de détacher silencieusement des produits.
   */
  async remove(categoryId: string): Promise<{ id: string }> {
    await sleep(LATENCY_MS)

    const index = fakeCategories.findIndex((c) => c.id === categoryId)
    if (index === -1) throw fail('NOT_FOUND', 'errors.notFound', `category ${categoryId} not found`)

    const childCount = fakeCategories.filter((c) => c.parentId === categoryId).length
    if (childCount > 0) {
      throw fail(
        'CONFLICT',
        'errors.category.hasChildrenDelete',
        `${childCount} sous-catégorie(s)`,
      )
    }

    const productCount = countProducts(categoryId)
    if (productCount > 0) {
      throw fail('CONFLICT', 'errors.category.inUse', `${productCount} produit(s) rattaché(s)`)
    }

    fakeCategories.splice(index, 1)
    return { id: categoryId }
  },
}
