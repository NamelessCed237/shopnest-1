import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  derivePrice,
  deriveStock,
  type CreateProductInput,
  type CreateVariantInput,
  type ListProductsQuery,
  type Product,
  type UpdateProductInput,
  type UpdateVariantInput,
} from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { ProductsRepository } from './products.repository'

/**
 * doc/03 §2 — logique métier. Ne connaît ni HTTP, ni Prisma, ni le tenantId.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository,
    private readonly events: EventEmitter2,
  ) {}

  list(query: ListProductsQuery) {
    return this.repo.list(query)
  }

  async detail(id: string) {
    const product = await this.repo.findById(id)
    // 404 et non 403 pour une ressource d'un autre tenant : un 403 confirmerait
    // son existence (doc/08 §3). Ici l'isolation a déjà filtré la requête.
    if (!product) throw new AppException('NOT_FOUND', `product ${id} not found`)
    return product
  }

  async create(input: CreateProductInput) {
    const existing = await this.repo.findBySlug(input.slug)
    if (existing) {
      throw new AppException('CONFLICT', `slug already used: ${input.slug}`, {
        fields: { slug: 'errors.product.slugTaken' },
      })
    }

    const product = await this.repo.create(input)
    // Réindexation Meilisearch en job asynchrone — hors du chemin de la réponse HTTP.
    this.events.emit('product.created', { productId: product.id })
    return product
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const current = await this.detail(id)

    if (input.slug !== undefined && input.slug !== current.slug) {
      const clash = await this.repo.findBySlug(input.slug)
      if (clash) {
        throw new AppException('CONFLICT', `slug already used: ${input.slug}`, {
          fields: { slug: 'errors.product.slugTaken' },
        })
      }
    }

    /*
     * Défense en profondeur : dès qu'une variante existe, stock et prix sont
     * RECALCULÉS et non repris du corps de requête.
     *
     * L'interface grise déjà ces champs, mais un formulaire ouvert avant
     * l'ajout d'une variante — ou un client obsolète — renverrait l'ancienne
     * valeur et corromprait le stock en silence. C'est la donnée dont l'erreur
     * coûte le plus cher : on vend ce qu'on n'a plus.
     */
    const hasVariants = current.variants.length > 0
    const stock = hasVariants
      ? deriveStock(current.variants, current.stock)
      : (input.stock ?? current.stock)
    const price = hasVariants
      ? derivePrice(current.variants, current.price)
      : (input.price ?? current.price)

    return this.repo.update(id, {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.lowStockThreshold !== undefined
        ? { lowStockThreshold: input.lowStockThreshold }
        : {}),
      ...(input.imageUrls !== undefined ? { imageUrls: input.imageUrls } : {}),
      ...(input.categoryIds !== undefined
        ? { categories: { set: input.categoryIds.map((categoryId) => ({ id: categoryId })) } }
        : {}),
      stock,
      priceCents: price.amountCents,
      currency: price.currency,
    })
  }

  async addVariant(productId: string, input: CreateVariantInput): Promise<Product> {
    await this.detail(productId)
    await this.assertSkuAvailable(input.sku)

    await this.repo.createVariant(productId, input)
    return this.reindexDerived(productId)
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
  ): Promise<Product> {
    await this.detail(productId)

    const variant = await this.repo.findVariant(productId, variantId)
    if (!variant) throw new AppException('NOT_FOUND', `variant ${variantId} not found`)

    if (input.sku !== undefined) await this.assertSkuAvailable(input.sku, variantId)

    await this.repo.updateVariant(variantId, input)
    return this.reindexDerived(productId)
  }

  async removeVariant(productId: string, variantId: string): Promise<Product> {
    const product = await this.detail(productId)

    const removed = product.variants.find((variant) => variant.id === variantId)
    if (!removed) throw new AppException('NOT_FOUND', `variant ${variantId} not found`)

    await this.repo.removeVariant(variantId)

    /*
     * En retirant la DERNIÈRE variante, le produit reprend le stock et le prix
     * de celle-ci plutôt que ses anciennes valeurs propres, périmées depuis
     * qu'il était géré par variantes. Le vendeur retrouve un produit vendable,
     * pas un fantôme à 0 F qu'il corrigerait sans y penser.
     */
    if (product.variants.length === 1) {
      return this.repo.update(productId, {
        stock: removed.stock,
        priceCents: removed.price.amountCents,
        currency: removed.price.currency,
      })
    }

    return this.reindexDerived(productId)
  }

  async archive(id: string) {
    await this.detail(id)
    return this.repo.softDelete(id)
  }

  /**
   * Réapplique les valeurs dérivées après toute modification de variantes.
   *
   * Sans ce recalcul, le produit garderait le stock saisi avant l'ajout des
   * variantes : la liste afficherait « 12 en stock » pour un produit dont les
   * variantes totalisent 0.
   */
  private async reindexDerived(productId: string): Promise<Product> {
    const product = await this.detail(productId)
    return this.repo.update(productId, {
      stock: deriveStock(product.variants, product.stock),
      priceCents: derivePrice(product.variants, product.price).amountCents,
    })
  }

  /**
   * Le SKU est unique à l'échelle du TENANT et non du produit : il identifie un
   * article en entrepôt et dans un export comptable, où le produit parent
   * n'apparaît pas (contrat `ProductVariantSchema`).
   */
  private async assertSkuAvailable(sku: string, exceptVariantId?: string): Promise<void> {
    const clash = await this.repo.findVariantBySku(sku)
    if (!clash || clash.id === exceptVariantId) return
    throw new AppException('CONFLICT', `sku already used: ${sku}`, {
      userMessageKey: 'errors.product.skuTaken',
      fields: { sku: 'errors.product.skuTaken' },
    })
  }
}
