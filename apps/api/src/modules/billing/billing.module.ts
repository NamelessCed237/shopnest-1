import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { BillingController } from './billing.controller'
import { BillingRepository } from './billing.repository'
import { BillingService } from './billing.service'

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController],
  providers: [BillingService, BillingRepository],
})
export class BillingModule {}
