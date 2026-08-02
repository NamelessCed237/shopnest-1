import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Corps brut nécessaire pour vérifier la signature des webhooks (doc/03 §6).
    rawBody: true,
  })

  app.use(helmet())
  app.setGlobalPrefix('api')
  app.useGlobalFilters(new AllExceptionsFilter())

  // CORS : liste blanche. Les domaines personnalisés des tenants sont chargés
  // dynamiquement depuis la base (avec cache Redis) — TODO(#3).
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)
  app.enableCors({ origin: allowed, credentials: true })

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  new Logger('bootstrap').log(`API prête sur http://localhost:${port}/api`)
}

void bootstrap()
