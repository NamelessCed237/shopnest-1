import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { ListProductsQuerySchema, type ListProductsQuery } from '@shopnest/contracts'
import { Public } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CatalogService } from './catalog.service'

/**
 * Catalogue PUBLIC — ce que la boutique montre aux visiteurs.
 *
 * Un contrôleur distinct de `products` plutôt qu'un `@Public()` posé sur
 * celui-ci. Les deux répondent des produits, mais pas les mêmes : le vendeur
 * voit ses brouillons, ses articles archivés, son stock exact et ses seuils
 * d'alerte. Un visiteur ne doit voir aucun des quatre.
 *
 * Partager les routes en filtrant selon l'authentification marcherait — jusqu'au
 * jour où un champ ajouté pour le vendeur se retrouve exposé parce que personne
 * n'a pensé à ce chemin-là.
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  list(@Query(new ZodValidationPipe(ListProductsQuerySchema)) query: ListProductsQuery) {
    return this.catalog.list(query)
  }

  /**
   * Par SLUG et non par identifiant : c'est l'URL que voit l'acheteur, celle
   * qu'il partage et celle que les moteurs indexent. Exposer un UUID
   * obligerait le storefront à une résolution supplémentaire à chaque page.
   */
  @Get('products/:slug')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug)
  }

  @Get('categories')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  categories() {
    return this.catalog.categories()
  }
}
