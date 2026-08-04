import { Injectable } from '@nestjs/common'
import {
  MAX_CATEGORY_DEPTH,
  wouldCreateCycle,
  type Category,
  type CategoryWithCounts,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@shopnest/contracts'
import { normalizeForSearch } from '@shopnest/utils'
import { AppException } from '../../common/errors/app.exception'
import { CategoriesRepository } from './categories.repository'
import { toCategoryWithCounts } from './categories.mapper'

/**
 * doc/03 §2 — logique métier. Ne connaît ni HTTP, ni Prisma.
 *
 * Les règles d'arborescence sont celles de @shopnest/contracts
 * (`MAX_CATEGORY_DEPTH`, `wouldCreateCycle`) : le formulaire les applique déjà,
 * mais un client modifié ne doit pas pouvoir corrompre l'arbre. Un cycle ferait
 * boucler tout parcours récursif — menu de la boutique, fil d'Ariane,
 * réindexation.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  /**
   * Liste APLATIE mais ORDONNÉE : chaque parent est immédiatement suivi de ses
   * enfants. Renvoyer un arbre imbriqué obligerait chaque client à le
   * reparcourir pour l'afficher, et interdirait de trier un tableau.
   */
  async list(search?: string): Promise<CategoryWithCounts[]> {
    const rows = await this.repo.findAll()
    const childCounts = new Map<string, number>()
    for (const row of rows) {
      if (row.parentId) childCounts.set(row.parentId, (childCounts.get(row.parentId) ?? 0) + 1)
    }

    const needle = search ? normalizeForSearch(search) : undefined
    const matches = (row: (typeof rows)[number]) =>
      !needle || normalizeForSearch(`${row.name} ${row.slug}`).includes(needle)

    const ordered: typeof rows = []
    for (const root of rows.filter((row) => !row.parentId)) {
      const children = rows.filter((row) => row.parentId === root.id)
      // Un parent est conservé si LUI ou l'un de ses enfants correspond :
      // masquer le parent laisserait les enfants orphelins à l'écran.
      const kept = children.filter(matches)
      if (matches(root)) ordered.push(root, ...children)
      else if (kept.length > 0) ordered.push(root, ...kept)
    }

    return ordered.map((row) => toCategoryWithCounts(row, childCounts.get(row.id) ?? 0))
  }

  async detail(id: string): Promise<CategoryWithCounts> {
    const row = await this.repo.findById(id)
    // 404 et non 403 pour une catégorie d'un autre tenant : un 403 confirmerait
    // son existence (doc/08 §3). L'isolation a déjà filtré la requête.
    if (!row) throw new AppException('NOT_FOUND', `category ${id} not found`)
    return toCategoryWithCounts(row, await this.repo.countChildren(id))
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    await this.assertSlugAvailable(input.slug)
    await this.assertParentValid(undefined, input.parentId)
    return this.repo.create(input)
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new AppException('NOT_FOUND', `category ${id} not found`)

    if (input.slug !== undefined) await this.assertSlugAvailable(input.slug, id)
    if ('parentId' in input) await this.assertParentValid(id, input.parentId)

    return this.repo.update(id, input)
  }

  /**
   * Suppression RÉELLE, contrairement aux produits.
   *
   * Une commande fige le nom et le prix du produit (doc/03 §4) mais ne
   * référence aucune catégorie : la supprimer ne peut donc pas rendre un
   * historique illisible. On refuse en revanche tant qu'elle est utilisée,
   * plutôt que de détacher des produits sans le dire.
   */
  async remove(id: string): Promise<{ id: string }> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new AppException('NOT_FOUND', `category ${id} not found`)

    const childCount = await this.repo.countChildren(id)
    if (childCount > 0) {
      throw new AppException('CONFLICT', `${childCount} sous-catégorie(s)`, {
        userMessageKey: 'errors.category.hasChildrenDelete',
      })
    }

    const productCount = await this.repo.countProducts(id)
    if (productCount > 0) {
      throw new AppException('CONFLICT', `${productCount} produit(s) rattaché(s)`, {
        userMessageKey: 'errors.category.inUse',
      })
    }

    return this.repo.remove(id)
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    const clash = await this.repo.findBySlug(slug)
    if (!clash || clash.id === exceptId) return
    throw new AppException('CONFLICT', `slug already used: ${slug}`, {
      userMessageKey: 'errors.category.slugTaken',
      fields: { slug: 'errors.category.slugTaken' },
    })
  }

  /** Les trois règles d'arborescence, appliquées CÔTÉ SERVEUR. */
  private async assertParentValid(
    categoryId: string | undefined,
    parentId: string | undefined,
  ): Promise<void> {
    if (!parentId) return

    const parent = await this.repo.findById(parentId)
    if (!parent) {
      throw new AppException('VALIDATION_FAILED', `unknown parent ${parentId}`, {
        userMessageKey: 'errors.category.parentNotFound',
        fields: { parentId: 'errors.category.parentNotFound' },
      })
    }

    // Un parent qui a lui-même un parent créerait un 3ᵉ niveau.
    if (parent.parentId) {
      throw new AppException('VALIDATION_FAILED', `depth > ${MAX_CATEGORY_DEPTH}`, {
        userMessageKey: 'errors.category.tooDeep',
        fields: { parentId: 'errors.category.tooDeep' },
      })
    }

    if (categoryId) {
      // L'arbre est borné à deux niveaux : le charger entièrement pour résoudre
      // les parents coûte une requête, contre une par saut si on remontait la
      // chaîne. `wouldCreateCycle` reste la règle partagée du contrat.
      const rows = await this.repo.findAll()
      const parentOf = (id: string) =>
        rows.find((row) => row.id === id)?.parentId ?? undefined

      if (wouldCreateCycle(categoryId, parentId, parentOf)) {
        throw new AppException('VALIDATION_FAILED', 'cycle detected', {
          userMessageKey: 'errors.category.cycle',
          fields: { parentId: 'errors.category.cycle' },
        })
      }

      // Une catégorie qui a déjà des enfants ne peut pas devenir enfant :
      // ses propres enfants se retrouveraient au 3ᵉ niveau.
      if (rows.some((row) => row.parentId === categoryId)) {
        throw new AppException('VALIDATION_FAILED', 'category has children', {
          userMessageKey: 'errors.category.hasChildren',
          fields: { parentId: 'errors.category.hasChildren' },
        })
      }
    }
  }
}
