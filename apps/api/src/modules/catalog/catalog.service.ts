import { Injectable } from '@nestjs/common'
import type { ListProductsQuery, Product } from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { PrismaService } from '../../database/prisma.service'
import { toProduct } from '../products/products.mapper'

/**
 * Vue publique du catalogue.
 *
 * Deux différences avec `ProductsService`, et elles sont volontaires :
 *   · `status: 'active'` est FORCÉ, pas proposé en filtre. Un visiteur ne
 *     choisit pas de voir les brouillons.
 *   · Le stock exact et le seuil d'alerte sont remplacés par une information
 *     bien plus pauvre : disponible ou non. « Plus que 2 en stock » renseigne
 *     surtout la concurrence sur le volume d'affaires de la boutique.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  async list(query: ListProductsQuery) {
    const rows = await this.db.product.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
        ...(query.categoryId ? { categories: { some: { id: query.categoryId } } } : {}),
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { [SORT_COLUMN[query.sortBy]]: query.sortOrder },
      include: { variants: true },
    })

    const hasNext = rows.length > query.limit
    const page = hasNext ? rows.slice(0, query.limit) : rows
    return {
      items: page.map((row) => publicView(toProduct(row))),
      nextCursor: hasNext ? page.at(-1)?.id : undefined,
    }
  }

  async detail(slug: string) {
    const row = await this.db.product.findFirst({
      where: { slug, status: 'active', deletedAt: null },
      include: { variants: true, categories: { select: { id: true } } },
    })
    // 404 pour un brouillon comme pour un slug inexistant : distinguer les deux
    // révélerait qu'un produit se prépare, et sous quelle adresse il sortira.
    if (!row) throw new AppException('NOT_FOUND', `no public product at ${slug}`)
    return publicView(toProduct(row))
  }

  async categories() {
    const rows = await this.db.category.findMany({
      // Seules les catégories qui mènent quelque part : une rubrique vide dans
      // le menu d'une boutique donne l'impression d'un catalogue en panne.
      where: { products: { some: { status: 'active', deletedAt: null } } },
      select: { id: true, name: true, slug: true, position: true },
      orderBy: { position: 'asc' },
    })
    return { items: rows }
  }
}

/**
 * Retire du produit ce qui ne regarde que le vendeur.
 *
 * Le stock devient un booléen. Le seuil d'alerte disparaît : couplé au stock,
 * il dirait à un concurrent à partir de quel niveau la boutique se réapprovisionne.
 */
function publicView(product: Product): PublicProduct {
  const { stock, lowStockThreshold: _threshold, ...rest } = product
  return {
    ...rest,
    inStock: stock > 0,
    variants: product.variants.map(({ stock: variantStock, ...variant }) => ({
      ...variant,
      inStock: variantStock > 0,
    })),
  }
}

export type PublicProduct = Omit<Product, 'stock' | 'lowStockThreshold' | 'variants'> & {
  inStock: boolean
  variants: (Omit<Product['variants'][number], 'stock'> & { inStock: boolean })[]
}

const SORT_COLUMN: Record<ListProductsQuery['sortBy'], string> = {
  createdAt: 'createdAt',
  name: 'name',
  price: 'priceCents',
  stock: 'stock',
}
