import { Injectable } from '@nestjs/common'
import type { CreateProductInput, ListProductsQuery } from '@shopnest/contracts'
import { PrismaService, tenantScoped } from '../../database/prisma.service'

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

  findById(id: string) {
    return this.db.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: true, categories: true },
    })
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
      orderBy: { [query.sortBy]: query.sortOrder },
      // include ciblé : évite le N+1 (doc/02 §2.3)
      include: { variants: true },
    })

    const hasNext = items.length > query.limit
    const page = hasNext ? items.slice(0, query.limit) : items
    return { items: page, nextCursor: hasNext ? page.at(-1)?.id : undefined }
  }

  create(input: CreateProductInput) {
    const { categoryIds, price, ...rest } = input
    return this.db.product.create({
      // tenantId est injecté par l'extension d'isolation — jamais écrit ici.
      data: tenantScoped({
        ...rest,
        priceCents: price.amountCents,
        currency: price.currency,
        categories: { connect: categoryIds.map((id) => ({ id })) },
      }),
    })
  }

  /** Soft delete : on ne casse jamais l'historique d'une commande (doc/03 §4). */
  softDelete(id: string) {
    return this.db.product.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
