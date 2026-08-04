import { randomUUID } from 'node:crypto'
import { Controller, Get, Inject, Param, Post, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { Public } from '../../common/decorators'
import { AppException } from '../../common/errors/app.exception'
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment.provider'
import { PaymentsService } from './payments.service'
import { SimulatedPaymentProvider } from './simulated.provider'

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    @Inject(PAYMENT_PROVIDERS) private readonly providers: readonly PaymentProvider[],
    @Inject('PAYMENT_PUBLIC_URL') private readonly publicUrl: string,
  ) {}

  /**
   * Point d'entrée des notifications de paiement.
   *
   * `@Public()` : le prestataire n'a pas de compte chez nous, et ne peut donc
   * présenter aucun jeton. L'authenticité vient de la SIGNATURE du corps, pas
   * d'une session — c'est la seule chose qu'un tiers ne peut pas fabriquer.
   *
   * Toujours 200, y compris sur un doublon. Un prestataire qui reçoit autre
   * chose réessaie, souvent longtemps ; répondre 409 sur un événement déjà
   * traité produirait des réémissions en boucle pour un travail déjà fait.
   */
  @Post('webhook/:provider')
  @Public()
  async webhook(
    @Param('provider') providerName: string,
    @Req() request: Request,
  ): Promise<{ status: string }> {
    /*
     * Le corps BRUT, jamais l'objet analysé.
     *
     * La signature porte sur les octets reçus. `JSON.parse` puis
     * `JSON.stringify` reproduit un texte équivalent mais rarement identique —
     * ordre des clés, espaces, échappement Unicode — et la signature ne
     * correspond plus. D'où `rawBody: true` au démarrage (`main.ts`).
     */
    const raw = (request as Request & { rawBody?: Buffer }).rawBody
    if (!raw) throw new AppException('VALIDATION_FAILED', 'raw body unavailable')

    return this.payments.handleWebhook(
      providerName,
      raw,
      request.headers as Record<string, string | undefined>,
    )
  }

  /**
   * Page de paiement SIMULÉE — l'équivalent local d'un formulaire hébergé.
   *
   * Deux boutons, et rien d'autre. Elle n'existe que si le prestataire simulé
   * est actif ; avec de vraies clés, la route répond 404 comme n'importe quel
   * chemin inconnu.
   */
  @Get('simulator/:correlationId')
  @Public()
  simulatorPage(
    @Param('correlationId') correlationId: string,
    @Query('amount') amount: string,
    @Query('currency') currency: string,
    @Query('ref') reference: string,
    @Res() response: Response,
  ): void {
    this.requireSimulator()
    response.type('html').send(simulatorHtml(this.publicUrl, correlationId, amount, currency, reference))
  }

  /**
   * Confirme ou fait échouer un paiement simulé.
   *
   * Elle ne touche PAS à la base directement : elle signe un corps et l'envoie
   * au vrai endpoint de webhook, par HTTP. Le raccourci aurait été plus simple
   * à écrire et n'aurait rien prouvé — c'est justement le chemin du webhook,
   * signature et déduplication comprises, qu'il faut exercer.
   */
  @Post('simulator/:correlationId/:outcome')
  @Public()
  async simulate(
    @Param('correlationId') correlationId: string,
    @Param('outcome') outcome: string,
  ): Promise<{ status: string }> {
    const simulator = this.requireSimulator()

    if (!['settled', 'failed', 'expired'].includes(outcome)) {
      throw new AppException('VALIDATION_FAILED', `unknown outcome ${outcome}`)
    }

    const body = Buffer.from(
      JSON.stringify({
        eventId: randomUUID(),
        correlationId,
        externalId: `sim_${correlationId}`,
        outcome,
        ...(outcome === 'failed' ? { failureReason: 'Solde insuffisant (simulation)' } : {}),
      }),
    )

    const response = await fetch(`${this.publicUrl}/payments/webhook/simulator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shopnest-signature': simulator.sign(body),
      },
      body,
    })

    if (!response.ok) {
      throw new AppException('INTERNAL', `webhook refused: HTTP ${response.status}`)
    }
    return (await response.json()) as { status: string }
  }

  private requireSimulator(): SimulatedPaymentProvider {
    const simulator = this.providers.find(
      (provider): provider is SimulatedPaymentProvider =>
        provider instanceof SimulatedPaymentProvider,
    )
    if (!simulator) throw new AppException('NOT_FOUND', 'simulator disabled')
    return simulator
  }
}

/**
 * Page volontairement brute : pas de feuille de style, pas de composant.
 *
 * Elle imite un formulaire hébergé chez un tiers — donc un domaine qui n'est
 * pas le nôtre et n'a aucune raison de ressembler à la boutique. La soigner
 * donnerait l'illusion qu'elle fait partie du produit ; elle disparaîtra le
 * jour où de vraies clés seront branchées.
 */
function simulatorHtml(
  publicUrl: string,
  correlationId: string,
  amount: string,
  currency: string,
  reference: string,
): string {
  const escaped = escapeHtml(correlationId)
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Paiement (simulation)</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:16px system-ui;margin:0;display:grid;place-items:center;height:100vh;background:#f1f5f9}
.card{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 1px 3px #0002;max-width:24rem}
button{font:inherit;padding:.6rem 1.2rem;border-radius:8px;border:0;cursor:pointer;margin-right:.5rem}
.ok{background:#16a34a;color:#fff}.ko{background:#dc2626;color:#fff}
p{color:#475569}</style></head>
<body><div class="card">
<h1>Paiement simulé</h1>
<p><strong>${escapeHtml(reference)}</strong><br>${escapeHtml(amount)} ${escapeHtml(currency)} (unités mineures)</p>
<p>Aucun prestataire réel n'est configuré. Choisissez l'issue à simuler.</p>
<button class="ok" onclick="send('settled')">Payer</button>
<button class="ko" onclick="send('failed')">Échouer</button>
<p id="out"></p>
</div>
<script>
async function send(outcome){
  document.getElementById('out').textContent='…';
  const r = await fetch(${JSON.stringify(publicUrl)}+'/payments/simulator/'+encodeURIComponent(${JSON.stringify(escaped)})+'/'+outcome,{method:'POST'});
  document.getElementById('out').textContent = r.ok ? 'Envoyé — revenez à la boutique.' : 'Erreur HTTP '+r.status;
}
</script></body></html>`
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )
}
