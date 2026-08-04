import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckoutSchema,
  PAYMENT_METHODS,
  requiresPayerPhone,
  type AppError,
  type CheckoutInput,
  type CheckoutResult,
  type PaymentMethod,
} from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, Dropdown, TextInput } from '@shopnest/ui-web'
import { cartSubtotal, useCart } from '@/features/cart/store'
import { storefront } from '@/lib/api'

export interface CheckoutFormProps {
  onPlaced: (result: CheckoutResult) => void
}

/**
 * Le formulaire de commande.
 *
 * Il valide avec `CheckoutSchema` — le MÊME schéma que le contrôleur. Pas une
 * copie « équivalente » : la règle « Mobile Money exige un numéro » est écrite
 * une fois, dans le contrat, et les deux côtés s'y réfèrent. Écrite deux fois,
 * elle diverge, et c'est toujours la version serveur qui devient laxiste.
 */
export function CheckoutForm({ onPlaced }: CheckoutFormProps) {
  const { t, money } = useTranslation()
  const lines = useCart((state) => state.lines)
  const clear = useCart((state) => state.clear)

  const [error, setError] = useState<AppError | undefined>()
  const [submitting, setSubmitting] = useState(false)

  /*
   * Le panier est recopié DANS le formulaire, pas ajouté au moment de l'envoi.
   *
   * `CheckoutSchema` exige au moins une ligne. Tant que `items` restait vide
   * dans l'état du formulaire, le résolveur le refusait avant même d'appeler
   * le gestionnaire — et comme aucun champ ne porte `items`, l'erreur ne
   * s'affichait nulle part : le bouton « Payer » ne faisait simplement rien.
   * Le plus mauvais des échecs, celui qui ne dit rien.
   */
  const items = lines.map((line) => ({
    productId: line.productId,
    ...(line.variantId ? { variantId: line.variantId } : {}),
    quantity: line.quantity,
  }))

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(CheckoutSchema),
    mode: 'onTouched',
    defaultValues: {
      items,
      email: '',
      paymentMethod: 'mtn_momo',
      payerPhone: '',
      shippingAddress: {
        fullName: '',
        phone: '',
        line1: '',
        city: '',
        country: 'CM',
      },
      /*
       * Tirée UNE FOIS, au montage du formulaire, et non à l'envoi.
       *
       * C'est toute la différence : une clé tirée à l'envoi serait neuve à
       * chaque tentative, et deux clics sur « Payer » créeraient deux
       * commandes. Tirée ici, elle identifie l'intention d'achat — donc le
       * second clic rejoue le premier et renvoie la même commande.
       */
      idempotencyKey: crypto.randomUUID(),
    },
  })

  const { register, handleSubmit, setValue, watch, formState } = form
  const values = watch()
  const subtotal = cartSubtotal(lines)

  /*
   * Resynchronisation : `defaultValues` n'est lu qu'au montage, et le panier
   * reste modifiable depuis le récapitulatif affiché à côté du formulaire.
   * Sans cela, retirer un article laisserait la commande partir avec.
   */
  useEffect(() => {
    setValue('items', items, { shouldValidate: formState.isSubmitted })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)])

  const fieldError = (path: string): string | undefined => {
    const message = path
      .split('.')
      .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], formState.errors)
    const text = (message as { message?: string } | undefined)?.message
    return text ? t(String(text)) : undefined
  }

  const submit = async (input: CheckoutInput) => {
    setSubmitting(true)
    setError(undefined)
    try {
      // `input` porte déjà `items`, validé par le même schéma que le serveur.
      const result = await storefront.checkout.create(input)

      /*
       * Le panier n'est vidé qu'après une réponse du serveur.
       *
       * Le vider à l'envoi ferait perdre son contenu au moindre refus — rupture
       * de stock, réseau coupé — et l'acheteur devrait tout resélectionner. À
       * ce stade la plupart abandonnent.
       */
      clear()
      onPlaced(result)
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-md">
      {error && (
        <Alert variant="danger" traceId={error.code === 'INTERNAL' ? error.traceId : undefined}>
          {t(error.userMessageKey)}
        </Alert>
      )}

      <Card title={t('storefront.checkout.contact')}>
        <TextInput
          label={t('storefront.checkout.email')}
          type="email"
          required
          helperText={t('storefront.checkout.emailHint')}
          error={fieldError('email')}
          {...register('email')}
        />
      </Card>

      <Card title={t('storefront.checkout.delivery')}>
        <div className="grid gap-md sm:grid-cols-2">
          <TextInput
            label={t('storefront.checkout.fullName')}
            required
            error={fieldError('shippingAddress.fullName')}
            {...register('shippingAddress.fullName')}
          />
          <TextInput
            label={t('storefront.checkout.phone')}
            required
            // Le livreur appelle : c'est le champ qui décide si le colis arrive.
            helperText={t('storefront.checkout.phoneHint')}
            error={fieldError('shippingAddress.phone')}
            {...register('shippingAddress.phone')}
          />
          <TextInput
            label={t('storefront.checkout.line1')}
            required
            error={fieldError('shippingAddress.line1')}
            {...register('shippingAddress.line1')}
          />
          <TextInput
            label={t('storefront.checkout.city')}
            required
            error={fieldError('shippingAddress.city')}
            {...register('shippingAddress.city')}
          />
          <TextInput
            label={t('storefront.checkout.country')}
            required
            maxLength={2}
            helperText={t('storefront.checkout.countryHint')}
            error={fieldError('shippingAddress.country')}
            {...register('shippingAddress.country')}
          />
        </div>
      </Card>

      <Card title={t('storefront.checkout.payment')}>
        <div className="flex flex-col gap-md">
          <Dropdown<PaymentMethod>
            label={t('storefront.checkout.method')}
            source={PAYMENT_METHODS.map((method) => ({
              value: method,
              // Mêmes libellés que côté vendeur : « MTN MoMo » doit s'écrire
              // pareil sur la boutique et sur la fiche de commande, sans quoi
              // les deux écrans semblent parler de deux choses.
              label: t(`orders.paymentMethod.${method}`),
            }))}
            value={values.paymentMethod}
            onChange={(value) => value && setValue('paymentMethod', value, { shouldDirty: true })}
          />

          {/*
            Le champ n'apparaît QUE pour Mobile Money, et la condition vient du
            contrat — `requiresPayerPhone`, la même fonction que le schéma
            utilise pour l'exiger. Un test écrit à la main ici finirait par
            afficher le champ quand le serveur ne le demande pas, ou l'inverse.
          */}
          {requiresPayerPhone(values.paymentMethod) && (
            <TextInput
              label={t('storefront.checkout.payerPhone')}
              required
              helperText={t('storefront.checkout.payerPhoneHint')}
              error={fieldError('payerPhone')}
              {...register('payerPhone')}
            />
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-md">
        <p className="text-sm text-text-secondary">
          {/*
            « Sous-total » et non « total » : la livraison n'est pas encore
            tarifée, et le serveur reste seul juge du montant débité.
          */}
          {t('storefront.checkout.subtotal')}{' '}
          <strong className="text-text-primary">{subtotal ? money(subtotal) : '—'}</strong>
        </p>
        <Button type="submit" loading={submitting} disabled={lines.length === 0}>
          {t('storefront.checkout.pay')}
        </Button>
      </div>
    </form>
  )
}
