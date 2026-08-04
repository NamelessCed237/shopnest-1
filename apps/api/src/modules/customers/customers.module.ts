import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { OrdersModule } from '../orders/orders.module'
import { CustomersController } from './customers.controller'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersRepository],
  exports: [CustomersService],
})
export class CustomersModule {}
