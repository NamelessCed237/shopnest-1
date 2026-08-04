import { Controller, Get, Query } from '@nestjs/common'
import { DASHBOARD_RANGES, type DashboardRange } from '@shopnest/contracts'
import { z } from 'zod'
import { Roles } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AnalyticsService } from './analytics.service'

const DashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('30d'),
})

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(6),
})

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 *
 * Les deux schémas de requête sont locaux et non dans @shopnest/contracts :
 * ils ne décrivent pas des données ÉCHANGÉES mais la forme d'une chaîne de
 * requête propre à ces trois routes. Les y remonter chargerait le contrat de
 * détails qu'aucun autre client n'a à connaître.
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @Roles('tenant_admin', 'tenant_staff')
  dashboard(@Query(new ZodValidationPipe(DashboardQuerySchema)) query: { range: DashboardRange }) {
    return this.analytics.dashboard(query.range)
  }

  @Get('statistics')
  @Roles('tenant_admin', 'tenant_staff')
  statistics(@Query(new ZodValidationPipe(DashboardQuerySchema)) query: { range: DashboardRange }) {
    return this.analytics.statistics(query.range)
  }

  @Get('recent-orders')
  @Roles('tenant_admin', 'tenant_staff')
  recentOrders(@Query(new ZodValidationPipe(ListQuerySchema)) query: { limit: number }) {
    return this.analytics.recentOrders(query.limit)
  }

  @Get('low-stock')
  @Roles('tenant_admin', 'tenant_staff')
  lowStock(@Query(new ZodValidationPipe(ListQuerySchema)) query: { limit: number }) {
    return this.analytics.lowStockProducts(query.limit)
  }
}
