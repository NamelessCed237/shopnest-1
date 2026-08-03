import { Injectable } from '@nestjs/common'
import type { CreateCategoryInput, UpdateCategoryInput } from '@shopnest/contracts'
import { PrismaService, tenantScoped } from '../../database/prisma.service'
import { toCategory } from './categories.mapper'

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 */
@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  /**
   * Charge TOUT l'arbre, avec le nombre de produits par catégorie.
   *
   * Une seule requête, sans pagination : la profondeur est bornée à 2 niveaux
   * (`MAX_CATEGORY_DEPTH`) et un catalogue réaliste compte quelques dizaines de
   * catégories. Paginer obligerait à charger les parents séparément pour ne pas
   * afficher d'enfants orphelins — plus de requêtes pour moins de données.
   */
  async findAll() {
    const rows = await this.db.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    })
    return rows
  }

  async findById(id: string) {
    return this.db.category.findFirst({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
  }

  async findBySlug(slug: string) {
    return this.db.category.findFirst({ where: { slug } })
  }

  async create(input: CreateCategoryInput) {
    const row = await this.db.category.create({
      data: tenantScoped({
        slug: input.slug,
        name: input.name,
        description: input.description,
        parentId: input.parentId ?? null,
        position: input.position,
      }),
    })
    return toCategory(row)
  }

  async update(id: string, input: UpdateCategoryInput) {
    const row = await this.db.category.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        // `parentId` est traité à part : `undefined` signifie « ne change pas »,
        // tandis qu'un parent explicitement retiré doit écrire `null`. Le
        // confondre avec « absent » rendrait impossible de remonter une
        // sous-catégorie au premier niveau.
        ...('parentId' in input ? { parentId: input.parentId ?? null } : {}),
      },
    })
    return toCategory(row)
  }

  async remove(id: string) {
    await this.db.category.delete({ where: { id } })
    return { id }
  }

  countChildren(parentId: string) {
    return this.db.category.count({ where: { parentId } })
  }

  countProducts(categoryId: string) {
    return this.db.product.count({
      where: { categories: { some: { id: categoryId } }, deletedAt: null },
    })
  }
}
