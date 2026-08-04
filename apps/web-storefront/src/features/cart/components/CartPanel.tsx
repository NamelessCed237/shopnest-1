import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Icon } from '@shopnest/ui-web'
import { cartSubtotal, lineKey, useCart } from '../store'

export interface CartPanelProps {
  /** Absent sur la page de commande : le panier n'y est qu'un récapitulatif. */
  onCheckout?: () => void
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const { t, money } = useTranslation()
  const lines = useCart((state) => state.lines)
  const setQuantity = useCart((state) => state.setQuantity)
  const remove = useCart((state) => state.remove)

  if (lines.length === 0) {
    return <Alert variant="info">{t('storefront.cart.empty')}</Alert>
  }

  const subtotal = cartSubtotal(lines)

  return (
    <div className="flex flex-col gap-md">
      <ul className="flex flex-col divide-y divide-border-base">
        {lines.map((line) => {
          const key = lineKey(line)
          return (
            <li key={key} className="flex items-center gap-md py-sm">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-text-disabled">
                    <Icon name="image" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text-primary">{line.name}</p>
                <p className="text-sm text-text-secondary">{money(line.unitPrice)}</p>
              </div>

              {/*
                Un champ nombre plutôt que deux boutons + / − : passer de 1 à 12
                demanderait onze clics. Le pas reste accessible au clavier via
                les flèches, que le navigateur fournit gratuitement.
              */}
              <label className="flex items-center gap-xs text-sm">
                <span className="sr-only">{t('storefront.cart.quantity')}</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={line.quantity}
                  onChange={(event) => setQuantity(key, Number(event.target.value))}
                  className="w-16 rounded-md border border-border-base bg-surface-base px-sm py-xs text-end text-text-primary"
                />
              </label>

              <p className="w-24 text-end font-medium text-text-primary">
                {money({
                  amountCents: line.unitPrice.amountCents * line.quantity,
                  currency: line.unitPrice.currency,
                })}
              </p>

              <button
                type="button"
                aria-label={t('storefront.cart.remove')}
                title={t('storefront.cart.remove')}
                onClick={() => remove(key)}
                className="rounded p-1 text-text-secondary hover:bg-surface-sunken hover:text-status-danger"
              >
                <Icon name="trash" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-md border-t border-border-base pt-md">
        <p className="text-text-primary">
          {t('storefront.cart.subtotal')}{' '}
          <strong className="text-lg">{subtotal ? money(subtotal) : '—'}</strong>
        </p>
        {onCheckout && <Button onClick={onCheckout}>{t('storefront.cart.checkout')}</Button>}
      </div>
    </div>
  )
}
