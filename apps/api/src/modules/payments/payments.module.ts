import { Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { DatabaseModule } from '../../database/database.module'
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment.provider'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { SimulatedPaymentProvider } from './simulated.provider'

/**
 * Les prestataires actifs sont choisis UNE FOIS au démarrage, d'après les clés
 * présentes — même principe que le pilote de stockage.
 *
 * Aucun drapeau `PAYMENT_PROVIDER=...` : la présence des clés EST la réponse.
 * Un drapeau de plus, c'est une façon de plus d'arriver en production avec le
 * simulateur actif parce que la variable a été oubliée.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): readonly PaymentProvider[] => {
        const logger = new Logger('PaymentProviders')
        const active: PaymentProvider[] = []

        /*
         * MTN MoMo, Orange Money et Stripe viendront ici, chacun sous
         * condition de ses propres clés. Ils ne sont pas écrits à l'avance :
         * un adaptateur qu'on ne peut ni appeler ni observer est du code mort
         * qui prétend fonctionner, et les trois APIs réservent des surprises
         * qu'aucune lecture de documentation ne révèle.
         *
         * L'interface `PaymentProvider` est là pour qu'ils s'ajoutent sans
         * toucher au tunnel ni au webhook.
         */

        if (active.length === 0) {
          logger.warn(
            'Aucune clé de prestataire — PAIEMENTS SIMULÉS. ' +
              "Aucun argent ne circule : l'issue est choisie à la main.",
          )
          active.push(
            new SimulatedPaymentProvider(
              config.get('API_PUBLIC_URL', { infer: true }),
              config.get('JWT_TENANT_SECRET', { infer: true }),
            ),
          )
        }

        return active
      },
    },
    {
      // Où le prestataire renvoie l'acheteur après un paiement par carte.
      provide: 'PAYMENT_RETURN_URL',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        `${config.get('STOREFRONT_PUBLIC_URL', { infer: true })}/checkout/retour`,
    },
    {
      provide: 'PAYMENT_PUBLIC_URL',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('API_PUBLIC_URL', { infer: true }),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
