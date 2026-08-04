import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  ListCustomersQuerySchema,
  ListOrdersQuerySchema,
  type ListCustomersQuery,
  type ListOrdersQuery,
} from '@shopnest/contracts'
import { Roles } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrdersService } from '../orders/orders.service'
import { CustomersService } from './customers.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 */
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Placée AVANT `:id` : Nest apparie les routes dans l'ordre de déclaration,
   * et `/customers/segments` serait sinon interprétée comme la fiche du client
   * d'identifiant « segments ».
   */
  @Get('segments')
  @Roles('tenant_admin', 'tenant_staff')
  segments() {
    return this.customers.segmentCounts()
  }

  @Get()
  @Roles('tenant_admin', 'tenant_staff')
  list(@Query(new ZodValidationPipe(ListCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.customers.list(query)
  }

  @Get(':id')
  @Roles('tenant_admin', 'tenant_staff')
  detail(@Param('id') id: string) {
    return this.customers.detail(id)
  }

  /**
   * Historique d'achats. Délégué au module commandes plutôt que réimplémenté :
   * la fiche client affiche les MÊMES commandes que l'écran dédié, avec le même
   * mapper et les mêmes règles de pagination.
   */
  @Get(':id/orders')
  @Roles('tenant_admin', 'tenant_staff')
  async orderHistory(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListOrdersQuerySchema)) query: ListOrdersQuery,
  ) {
    // Vérifie l'existence AVANT de lister : sans cela un identifiant inconnu
    // renverrait une page vide, indiscernable d'un client sans commande.
    await this.customers.detail(id)
    return this.orders.list({ ...query, customerId: id })
  }
}
