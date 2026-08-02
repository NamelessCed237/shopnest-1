import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import {
  CreateProductSchema,
  ListProductsQuerySchema,
  type CreateProductInput,
  type ListProductsQuery,
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

  @Delete(':id')
  @Roles('tenant_admin')
  archive(@Param('id') id: string) {
    return this.products.archive(id)
  }
}
