import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@shopnest/contracts'
import { Roles } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CategoriesService } from './categories.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /**
   * Renvoie une PAGE et non un tableau nu, alors que la réponse n'est jamais
   * paginée (l'arbre est borné à deux niveaux, doc/03 §2).
   *
   * C'est le prix de l'uniformité : le résolveur d'entités générique
   * (`createEntityResolver`, doc/07 §3.1) alimente toutes les listes
   * déroulantes en lisant `page.items`. Un tableau nu obligerait à lui ajouter
   * un cas particulier pour cette seule route — et le suivant à faire pareil.
   */
  @Get()
  @Roles('tenant_admin', 'tenant_staff')
  async list(@Query('search') search?: string) {
    const items = await this.categories.list(search)
    return { items, total: items.length }
  }

  @Get(':id')
  @Roles('tenant_admin', 'tenant_staff')
  detail(@Param('id') id: string) {
    return this.categories.detail(id)
  }

  // Pas de garde de quota : PLAN_LIMITS ne plafonne pas les catégories, et en
  // inventer une ici la mettrait hors de la source de vérité unique (doc/02 §1.2).
  @Post()
  @Roles('tenant_admin')
  create(@Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryInput) {
    return this.categories.create(dto)
  }

  @Patch(':id')
  @Roles('tenant_admin')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryInput,
  ) {
    return this.categories.update(id, dto)
  }

  @Delete(':id')
  @Roles('tenant_admin')
  remove(@Param('id') id: string) {
    return this.categories.remove(id)
  }
}
