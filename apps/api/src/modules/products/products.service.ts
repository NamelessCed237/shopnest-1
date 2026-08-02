import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { CreateProductInput, ListProductsQuery } from '@shopnest/contracts'
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

  async archive(id: string) {
    await this.detail(id)
    return this.repo.softDelete(id)
  }
}
