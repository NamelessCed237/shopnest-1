import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsQuery,
  UpdateVariantInput,
} from '@shopnest/contracts'
import { PrismaService, tenantScoped } from '../../database/prisma.service'
import { toProduct } from './products.mapper'

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 *
 * Aucun `tenantId` n'est écrit ici : l'extension d'isolation l'injecte.
 * Le jour où l'on migre vers « schema par tenant », seul ce fichier change.
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  findBySlug(slug: string) {
    return this.db.product.findFirst({ where: { slug, deletedAt: null } })
  }

  async findById(id: string) {
    const row = await this.db.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: true, categories: { select: { id: true } } },
    })
    return row ? toProduct(row) : null
  }

  /** doc/02 §2.3 — pagination par curseur, jamais par offset. */
  async list(query: ListProductsQuery) {
    const items = await this.db.product.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
        ...(query.categoryId ? { categories: { some: { id: query.categoryId } } } : {}),
      },
      // +1 pour savoir s'il existe une page suivante sans faire de COUNT.
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      // Le contrat expose `price`, la table stocke `price_cents` : trier sur le
      // nom du contrat produirait un « Unknown argument price » à l'exécution.
      orderBy: { [SORT_COLUMN[query.sortBy]]: query.sortOrder },
      // include ciblé : évite le N+1 (doc/02 §2.3)
      include: { variants: true },
    })

    const hasNext = items.length > query.limit
    const page = hasNext ? items.slice(0, query.limit) : items
    return { items: page.map(toProduct), nextCursor: hasNext ? page.at(-1)?.id : undefined }
  }

  async create(input: CreateProductInput) {
    const { categoryIds, price, ...rest } = input
    const row = await this.db.product.create({
      include: { variants: true, categories: { select: { id: true } } },
      // tenantId est injecté par l'extension d'isolation — jamais écrit ici.
      data: tenantScoped({
        ...rest,
        priceCents: price.amountCents,
        currency: price.currency,
        categories: { connect: categoryIds.map((id) => ({ id })) },
      }),
    })
    return toProduct(row)
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    const row = await this.db.product.update({
      where: { id },
      data,
      include: { variants: true, categories: { select: { id: true } } },
    })
    return toProduct(row)
  }

  findVariantBySku(sku: string) {
    return this.db.productVariant.findFirst({ where: { sku } })
  }

  createVariant(productId: string, input: CreateVariantInput) {
    return this.db.productVariant.create({
      data: tenantScoped({
        productId,
        sku: input.sku,
        name: input.name,
        priceCents: input.price.amountCents,
        stock: input.stock,
        attributes: input.attributes,
      }),
    })
  }

  findVariant(productId: string, variantId: string) {
    return this.db.productVariant.findFirst({ where: { id: variantId, productId } })
  }

  updateVariant(variantId: string, input: UpdateVariantInput) {
    return this.db.productVariant.update({
      where: { id: variantId },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.price !== undefined ? { priceCents: input.price.amountCents } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      },
    })
  }

  async removeVariant(variantId: string) {
    await this.db.productVariant.deleteMany({ where: { id: variantId } })
  }

  /** Soft delete : on ne casse jamais l'historique d'une commande (doc/03 §4). */
  async softDelete(id: string) {
    const row = await this.db.product.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { variants: true, categories: { select: { id: true } } },
    })
    return toProduct(row)
  }
}

/** Nom du contrat → colonne Prisma, pour les seules clés de tri exposées. */
const SORT_COLUMN: Record<ListProductsQuery['sortBy'], string> = {
  createdAt: 'createdAt',
  name: 'name',
  price: 'priceCents',
  stock: 'stock',
}
