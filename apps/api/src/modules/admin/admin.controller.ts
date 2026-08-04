import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common'
import {
  ListTenantsQuerySchema,
  UpdateTenantPlanSchema,
  UpdateTenantThemeSchema,
  type ListTenantsQuery,
  type UpdateTenantPlanInput,
  type UpdateTenantThemeInput,
} from '@shopnest/contracts'
import { Audited, CrossTenant, Roles } from '../../common/decorators'
import type { AuthenticatedRequest } from '../../common/guards/jwt-auth.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminService } from './admin.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate.
 *
 * Le préfixe `/admin/` n'est pas cosmétique : `JwtAuthGuard` en DÉDUIT
 * l'audience `admin`, donc le secret JWT utilisé pour vérifier le jeton
 * (doc/03 §5). Un jeton de vendeur présenté ici échoue à la vérification de
 * signature — pas seulement au contrôle de rôle.
 */
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('summary')
  @Roles('super_admin')
  @CrossTenant()
  @Audited('platform.summary.read')
  summary() {
    return this.admin.platformSummary()
  }

  @Get('tenants')
  @Roles('super_admin')
  @CrossTenant()
  @Audited('tenants.list')
  list(@Query(new ZodValidationPipe(ListTenantsQuerySchema)) query: ListTenantsQuery) {
    return this.admin.listTenants(query)
  }

  @Get('tenants/:id')
  @Roles('super_admin')
  @CrossTenant()
  @Audited('tenant.read')
  detail(@Param('id') id: string) {
    return this.admin.tenant(id)
  }

  /**
   * Thème par défaut d'une boutique.
   *
   * L'identifiant de l'acteur vient de la REQUÊTE et non du corps : un client
   * pouvant nommer l'auteur d'une action rendrait le journal d'audit inutile.
   */
  @Patch('tenants/:id/theme')
  @Roles('super_admin')
  @CrossTenant()
  @Audited('tenant.theme.updated')
  updateTheme(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTenantThemeSchema)) dto: UpdateTenantThemeInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.admin.updateTheme(id, request.user!.id, dto.theme)
  }

  @Patch('tenants/:id/plan')
  @Roles('super_admin')
  @CrossTenant()
  @Audited('tenant.plan.updated')
  updatePlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTenantPlanSchema)) dto: UpdateTenantPlanInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.admin.updatePlan(id, request.user!.id, dto.planCode)
  }
}
