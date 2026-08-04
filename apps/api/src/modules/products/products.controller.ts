import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  CreateProductSchema,
  CreateVariantSchema,
  ListProductsQuerySchema,
  UpdateProductSchema,
  UpdateVariantSchema,
  type CreateProductInput,
  type CreateVariantInput,
  type ListProductsQuery,
  type UpdateProductInput,
  type UpdateVariantInput,
} from '@shopnest/contracts'
import { Roles } from '../../common/decorators'
import { PlanLimitGuard } from '../../common/guards/plan-limit.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ProductsService } from './products.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Roles('tenant_admin', 'tenant_staff')
  list(@Query(new ZodValidationPipe(ListProductsQuerySchema)) query: ListProductsQuery) {
    return this.products.list(query)
  }

  @Get(':id')
  @Roles('tenant_admin', 'tenant_staff')
  detail(@Param('id') id: string) {
    return this.products.detail(id)
  }

  @Post()
  @Roles('tenant_admin')
  @UseGuards(PlanLimitGuard('products'))
  create(@Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductInput) {
    return this.products.create(dto)
  }

  @Patch(':id')
  @Roles('tenant_admin')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductInput,
  ) {
    return this.products.update(id, dto)
  }

  /**
   * Les trois routes de variantes renvoient le PRODUIT complet, pas la variante.
   *
   * Ajouter ou retirer une variante change le stock et le prix dérivés du
   * produit (`deriveStock` / `derivePrice`) : renvoyer la seule variante
   * obligerait le client à rejouer une règle métier qui vit dans le contrat.
   */
  @Post(':id/variants')
  @Roles('tenant_admin')
  addVariant(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateVariantSchema)) dto: CreateVariantInput,
  ) {
    return this.products.addVariant(id, dto)
  }

  @Patch(':id/variants/:variantId')
  @Roles('tenant_admin')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body(new ZodValidationPipe(UpdateVariantSchema)) dto: UpdateVariantInput,
  ) {
    return this.products.updateVariant(id, variantId, dto)
  }

  @Delete(':id/variants/:variantId')
  @Roles('tenant_admin')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.products.removeVariant(id, variantId)
  }

  @Delete(':id')
  @Roles('tenant_admin')
  archive(@Param('id') id: string) {
    return this.products.archive(id)
  }
}
