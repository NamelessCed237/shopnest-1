import { Controller, Get } from '@nestjs/common'
import { Roles } from '../../common/decorators'
import { BillingService } from './billing.service'

/**
 * doc/03 §2 — HTTP uniquement : parse, délègue, formate. Zéro logique métier.
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /**
   * Réservé à `tenant_admin` : les commissions et le plan relèvent du contrat
   * commercial de la boutique, pas du travail quotidien d'un employé.
   */
  @Get('summary')
  @Roles('tenant_admin')
  summary() {
    return this.billing.summary()
  }
}
