import { Body, Controller, Get, Patch } from '@nestjs/common'
import { UpdateTenantSettingsSchema, type UpdateTenantSettingsInput } from '@shopnest/contracts'
import { Roles } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { SettingsService } from './settings.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Lecture ouverte à l'équipe : un employé a besoin de la devise et du pays. */
  @Get()
  @Roles('tenant_admin', 'tenant_staff')
  profile() {
    return this.settings.profile()
  }

  /** Écriture réservée à l'administrateur : le domaine engage la boutique. */
  @Patch()
  @Roles('tenant_admin')
  update(@Body(new ZodValidationPipe(UpdateTenantSettingsSchema)) dto: UpdateTenantSettingsInput) {
    return this.settings.update(dto)
  }

  @Get('team')
  @Roles('tenant_admin')
  team() {
    return this.settings.team()
  }
}
