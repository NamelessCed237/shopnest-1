import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ListOrdersQuerySchema,
  RefundOrderSchema,
  UpdateOrderStatusSchema,
  type ListOrdersQuery,
  type RefundOrderInput,
  type UpdateOrderStatusInput,
} from '@shopnest/contracts'
import { Roles } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrdersService } from './orders.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @Roles('tenant_admin', 'tenant_staff')
  list(@Query(new ZodValidationPipe(ListOrdersQuerySchema)) query: ListOrdersQuery) {
    return this.orders.list(query)
  }

  @Get(':id')
  @Roles('tenant_admin', 'tenant_staff')
  detail(@Param('id') id: string) {
    return this.orders.detail(id)
  }

  /**
   * `PATCH` et non `POST /transitions` : c'est une modification partielle de la
   * commande, et le client n'a pas à connaître un vocabulaire de transitions
   * distinct de celui du champ `status` qu'il lit.
   */
  @Patch(':id/status')
  @Roles('tenant_admin', 'tenant_staff')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) dto: UpdateOrderStatusInput,
  ) {
    return this.orders.updateStatus(id, dto)
  }

  /**
   * Rembourser touche à l'argent : réservé à `tenant_admin`, alors qu'un
   * employé peut faire avancer une commande.
   */
  @Post(':id/refund')
  @Roles('tenant_admin')
  refund(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RefundOrderSchema)) dto: RefundOrderInput,
  ) {
    return this.orders.refund(id, dto)
  }
}
