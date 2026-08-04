import { Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { LocalStorageDriver } from './local-storage.driver'
import { STORAGE_DRIVER } from './storage.driver'
import { SupabaseStorageDriver } from './supabase-storage.driver'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './uploads.service'

/**
 * Le pilote est choisi UNE FOIS au démarrage, d'après la configuration.
 *
 * Pas de drapeau `STORAGE_DRIVER=local|supabase` à régler : la présence des
 * identifiants Supabase est déjà la réponse. Un drapeau de plus, c'est une
 * façon de plus de se retrouver en production avec le pilote de développement
 * parce que la variable a été oubliée — et `env.schema` exige de toute façon
 * ces identifiants hors développement.
 *
 * Le choix est JOURNALISÉ : « où sont parties mes images » est la première
 * question posée quand une vignette ne s'affiche pas.
 */
@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('StorageDriver')
        const baseUrl = config.get('SUPABASE_URL', { infer: true })
        const serviceRoleKey = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true })

        if (baseUrl && serviceRoleKey) {
          const bucket = config.get('STORAGE_BUCKET', { infer: true })
          logger.log(`Supabase Storage — bucket « ${bucket} »`)
          return new SupabaseStorageDriver(baseUrl, serviceRoleKey, bucket)
        }

        logger.warn(
          'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absentes — stockage sur DISQUE LOCAL. ' +
            'Les fichiers ne survivront pas à un redéploiement.',
        )
        return new LocalStorageDriver(
          config.get('STORAGE_LOCAL_DIR', { infer: true }),
          config.get('API_PUBLIC_URL', { infer: true }),
          config.get('JWT_TENANT_SECRET', { infer: true }),
        )
      },
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
