import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { OrdersModule } from '../orders/orders.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsRepository } from './analytics.repository'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}
