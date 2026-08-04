import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { IdempotencyModule } from '../../common/idempotency/idempotency.module'
import { OrdersController } from './orders.controller'
import { OrdersRepository } from './orders.repository'
import { OrdersService } from './orders.service'

@Module({
  imports: [DatabaseModule, IdempotencyModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
