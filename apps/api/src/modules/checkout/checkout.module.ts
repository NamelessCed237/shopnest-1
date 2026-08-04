import { Module } from '@nestjs/common'
import { IdempotencyModule } from '../../common/idempotency/idempotency.module'
import { DatabaseModule } from '../../database/database.module'
import { PaymentsModule } from '../payments/payments.module'
import { CheckoutController } from './checkout.controller'
import { CheckoutRepository } from './checkout.repository'
import { CheckoutService } from './checkout.service'

@Module({
  imports: [DatabaseModule, IdempotencyModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutRepository],
})
export class CheckoutModule {}
