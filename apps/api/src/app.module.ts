import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { validateEnv } from './config/env.schema'
import { DatabaseModule } from './database/database.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { AuthModule } from './modules/auth/auth.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { ProductsModule } from './modules/products/products.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { OrdersModule } from './modules/orders/orders.module'
import { CustomersModule } from './modules/customers/customers.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { BillingModule } from './modules/billing/billing.module'
import { SettingsModule } from './modules/settings/settings.module'
import { AdminModule } from './modules/admin/admin.module'
import { UploadsModule } from './modules/uploads/uploads.module'
import { TenantResolverMiddleware } from './tenancy/tenant-resolver.middleware'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Le .env vit à la RACINE du monorepo, pas dans apps/api : un seul
      // fichier de secrets pour tout le dépôt, donc un seul endroit à
      // sécuriser et aucun risque de divergence entre applications.
      envFilePath: ['../../.env'],
    }),
    EventEmitterModule.forRoot(),
    // doc/03 §5 — limite générale ; les endpoints sensibles ont la leur via @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    AuthModule,
    TenantsModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CustomersModule,
    AnalyticsModule,
    BillingModule,
    SettingsModule,
    AdminModule,
    UploadsModule,
  ],
  providers: [
    // L'ordre compte : débit → authentification → autorisation.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // doc/03 §3.1 — le résolveur de tenant s'exécute AVANT tout le reste,
    // sur toutes les routes sans exception.
    consumer.apply(TenantResolverMiddleware).forRoutes('*')
  }
}
