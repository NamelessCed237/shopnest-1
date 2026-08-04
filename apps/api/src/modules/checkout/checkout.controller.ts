import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { CheckoutSchema, type CheckoutInput } from '@shopnest/contracts'
import { Public } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CheckoutService } from './checkout.service'

/**
 * Le SEUL contrôleur ouvert en écriture sans authentification.
 *
 * C'est la nature d'une boutique : l'acheteur n'a pas de compte, et lui en
 * imposer un ferait perdre la vente. Le contexte tenant vient donc du
 * sous-domaine — jamais du corps de la requête, qui ne doit pas pouvoir
 * désigner la boutique qu'il souhaite débiter.
 */
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  /**
   * Débit VOLONTAIREMENT bas.
   *
   * Chaque appel relit le catalogue, écrit une commande et sollicite un
   * prestataire. Sans bride, une boucle réserverait tout le stock d'une
   * boutique en quelques secondes — les commandes resteraient impayées, mais
   * les articles seraient invendables entre-temps.
   */
  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(@Body(new ZodValidationPipe(CheckoutSchema)) dto: CheckoutInput) {
    return this.checkout.checkout(dto)
  }

  /**
   * Suivi par laissez-passer.
   *
   * Le jeton est dans le CHEMIN et non en paramètre de requête : les chaînes
   * de requête finissent dans les journaux des proxys et dans le `Referer`
   * envoyé aux ressources tierces de la page.
   *
   * Bridé aussi : c'est un endpoint ouvert dont on interroge la réponse en
   * boucle pendant qu'un paiement Mobile Money se confirme.
   */
  @Get('track/:token')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  track(@Param('token') token: string) {
    return this.checkout.track(token)
  }
}
