import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppError, CheckoutResult, OrderTracking } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, Icon } from '@shopnest/ui-web'
import { storefront } from '@/lib/api'

/**
 * Ce qui se passe APRÈS « Payer ».
 *
 * Un seul composant pour les trois issues, parce qu'elles partagent l'essentiel :
 * la commande existe déjà, et son état va changer sans que l'acheteur fasse
 * quoi que ce soit. Ce qui diffère, c'est ce qu'on lui demande en attendant —
 * d'où l'union discriminée du contrat, qui rend l'oubli d'un cas impossible à
 * compiler.
 */
export function PaymentStep({ result }: { result: CheckoutResult }) {
  const { t, money } = useTranslation()

  /*
   * Interrogation périodique, et non « attendre un événement ».
   *
   * La confirmation arrive par webhook, côté serveur : le navigateur de
   * l'acheteur n'en est pas destinataire. Il faut donc qu'il redemande. Un
   * WebSocket ferait mieux et suppose une connexion maintenue ouverte pendant
   * deux minutes sur une 3G qui coupe — pour une attente qui se termine
   * presque toujours en moins de trente secondes.
   */
  const tracking = useQuery<OrderTracking, AppError>({
    queryKey: ['tracking', result.trackingToken],
    queryFn: ({ signal }) => storefront.checkout.track(result.trackingToken, { signal }),
    // On cesse d'interroger dès que l'état est ARRÊTÉ : continuer sur une
    // commande payée est du trafic pur, et le compteur de débit finirait par
    // fermer la porte à un acheteur qui n'a rien demandé.
    refetchInterval: (query) => (isSettledState(query.state.data?.status) ? false : 3_000),
    /*
     * On continue d'interroger MÊME onglet caché — à rebours du réglage
     * habituel, et c'est tout l'intérêt.
     *
     * Sur cet écran précis, l'acheteur QUITTE forcément la page : il bascule
     * vers son application Mobile Money, ou vers le SMS qui porte la demande.
     * C'est exactement le moment où la confirmation arrive. Avec le défaut,
     * l'interrogation s'arrête pile à cet instant, et il revient sur un écran
     * qui affiche encore « en attente » alors qu'il vient de payer.
     *
     * Le coût est borné : une requête toutes les trois secondes pendant deux
     * minutes au plus, puis plus rien.
     */
    refetchIntervalInBackground: true,
  })

  const status = tracking.data?.status ?? result.order.status

  /*
   * Le laissez-passer est mémorisé.
   *
   * L'acheteur ferme l'onglet, coupe la connexion, ou revient du formulaire de
   * carte de son prestataire — dans les trois cas, sans ce jeton il perd tout
   * moyen de savoir où en est sa commande, et n'a qu'un numéro de référence
   * qu'aucun endpoint public n'accepte.
   */
  useEffect(() => {
    localStorage.setItem('shopnest.lastOrder', result.trackingToken)
  }, [result.trackingToken])

  return (
    <div className="flex flex-col gap-md">
      <Card title={t('storefront.payment.title', { reference: result.order.reference })}>
        <div className="flex flex-col gap-md">
          <p className="text-sm text-text-secondary">
            {t('storefront.payment.amount')}{' '}
            <strong className="text-text-primary">{money(result.order.total)}</strong>
          </p>

          {status === 'paid' && (
            <Alert variant="success" title={t('storefront.payment.paidTitle')}>
              {t('storefront.payment.paidBody', { email: result.order.email ?? '' })}
            </Alert>
          )}

          {status === 'payment_failed' && (
            <Alert variant="danger" title={t('storefront.payment.failedTitle')}>
              {t('storefront.payment.failedBody')}
            </Alert>
          )}

          {!isSettledState(status) && <Pending result={result} />}
        </div>
      </Card>

      <p className="text-xs text-text-secondary">
        {t('storefront.payment.keepToken')} <code>{result.trackingToken}</code>
      </p>
    </div>
  )
}

function Pending({ result }: { result: CheckoutResult }) {
  const { t } = useTranslation()
  const { next } = result

  switch (next.type) {
    case 'awaitConfirmation':
      return (
        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-sm text-text-primary">
            <Icon name="smartphone" size="lg" />
            <p className="font-medium">
              {t('storefront.payment.awaitTitle', { phone: next.payerPhone })}
            </p>
          </div>
          <p className="text-sm text-text-secondary">{t('storefront.payment.awaitBody')}</p>
          <Countdown expiresAt={next.expiresAt} />
        </div>
      )

    case 'redirect':
      return (
        <div className="flex flex-col items-start gap-sm">
          <p className="text-sm text-text-secondary">{t('storefront.payment.redirectBody')}</p>
          {/*
            Un LIEN que l'acheteur actionne, pas une redirection automatique.
            Partir de la page sans prévenir, alors que la commande vient d'être
            créée, donne l'impression d'avoir perdu le fil — et empêche de
            noter la référence affichée juste au-dessus.
          */}
          <Button onClick={() => window.location.assign(next.url)}>
            {t('storefront.payment.redirectAction')}
          </Button>
        </div>
      )

    case 'instructions':
      return (
        <div className="flex flex-col gap-sm">
          <p className="text-sm text-text-secondary">{t('storefront.payment.transferBody')}</p>
          <ul className="rounded-md bg-surface-sunken p-md text-sm text-text-primary">
            {next.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )
  }
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useTranslation()

  /*
   * Un compte à rebours doit COMPTER.
   *
   * Calculé une seule fois au rendu, il affichait « expire dans 1 min 53 s » et
   * n'en bougeait plus : React n'a aucune raison de re-rendre puisque rien
   * dans ses props ne change. L'acheteur voyait donc un chiffre figé pendant
   * deux minutes — pire qu'aucun compteur, puisqu'il donne l'impression que la
   * page a cessé de fonctionner, juste au moment où on lui demande d'attendre.
   */
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt))

  useEffect(() => {
    setRemaining(secondsUntil(expiresAt))
    const timer = setInterval(() => setRemaining(secondsUntil(expiresAt)), 1_000)
    // Nettoyage : sans lui, le minuteur survit au démontage et fait travailler
    // React sur un composant disparu à chaque seconde.
    return () => clearInterval(timer)
  }, [expiresAt])

  return (
    <p className="text-sm text-text-secondary">
      {remaining > 0
        ? t('storefront.payment.expiresIn', {
            minutes: Math.floor(remaining / 60),
            seconds: String(remaining % 60).padStart(2, '0'),
          })
        : t('storefront.payment.expired')}
    </p>
  )
}

/**
 * États dont plus rien ne bouge tout seul.
 *
 * `payment_failed` en fait partie : c'est un échec DÉFINITIF de cette
 * tentative. Réessayer produit une nouvelle commande, pas une reprise de
 * celle-ci — continuer à interroger celle-là n'apprendrait plus rien.
 */
const isSettledState = (status?: string): boolean =>
  status === 'paid' || status === 'payment_failed' || status === 'cancelled'

const secondsUntil = (iso: string): number =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000))
