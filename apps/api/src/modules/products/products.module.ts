import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { ProductsController } from './products.controller'
import { ProductsRepository } from './products.repository'
import { ProductsService } from './products.service'

@Module({
  imports: [DatabaseModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
