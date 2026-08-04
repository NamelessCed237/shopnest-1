import { Link, useParams } from '@tanstack/react-router'
import type { Order } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card } from '@shopnest/ui-web'
import {
  OrderActions,
  OrderItemsCard,
  OrderPaymentCard,
  OrderProgress,
  OrderStatusBadge,
  OrderTotalsCard,
  useOrder,
} from '@/features/orders'

export function OrderDetailPage() {
  const { t, date, money } = useTranslation()
  const { orderId } = useParams({ from: '/authenticated/orders/$orderId' })
  const query = useOrder(orderId)

  return (
    <div className="flex flex-col gap-lg">
      <div className="print:hidden">
        <Link to="/orders" className="text-sm text-brand-primary hover:underline">
          ← {t('orders.detail.back')}
        </Link>
      </div>

      {query.isPending && <DetailSkeleton />}

      {query.isError && (
        <Card>
          <div className="flex flex-col items-start gap-md">
            <Alert
              variant="danger"
              traceId={query.error.code === 'INTERNAL' ? query.error.traceId : undefined}
            >
              {t(query.error.userMessageKey)}
            </Alert>

            {query.error.code === 'NOT_FOUND' ? (
              <Link to="/orders">
                <Button variant="secondary">{t('orders.detail.back')}</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => void query.refetch()}>
                {t('common.retry')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {query.data && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-md">
            <div className="flex flex-col gap-xs">
              <div className="flex flex-wrap items-center gap-sm">
                <h1 className="text-xl font-semibold tabular-nums text-text-primary">
                  {query.data.reference}
                </h1>
                <OrderStatusBadge status={query.data.status} />
              </div>
              <p className="text-sm text-text-secondary">
                {t('orders.detail.placedOn', { date: date(query.data.createdAt) })}
              </p>
            </div>

            {/* `print:hidden` : la barre d'actions n'a pas de sens sur une facture. */}
            <div className="print:hidden">
              <OrderActions order={query.data} onPrintInvoice={() => window.print()} />
            </div>
          </header>

          {query.data.refundedAmount && (
            <Alert
              variant="warning"
              title={t(
                query.data.status === 'refunded'
                  ? 'orders.refund.banner'
                  : 'orders.refund.bannerPartial',
              )}
            >
              {t('orders.refund.bannerBody', {
                amount: money(query.data.refundedAmount),
                total: money(query.data.total),
              })}
            </Alert>
          )}

          <div className="print:hidden">
            <OrderProgress status={query.data.status} />
          </div>

          <div className="grid grid-cols-1 gap-md xl:grid-cols-[3fr_2fr]">
            <div className="flex flex-col gap-md">
              <OrderItemsCard order={query.data} />
            </div>

            <div className="flex flex-col gap-md">
              <CustomerCard order={query.data} />
              <OrderTotalsCard order={query.data} />
              <OrderPaymentCard order={query.data} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function CustomerCard({ order }: { order: Order }) {
  const { t } = useTranslation()
  const customerId = order.customerId

  if (!customerId) {
    return (
      <Card title={t('orders.columns.customer')}>
        <p className="text-sm text-text-secondary">{t('orders.detail.guestCustomer')}</p>
      </Card>
    )
  }

  return (
    <Card title={t('orders.columns.customer')}>
      <div className="flex flex-col gap-xs text-sm">
        <span className="font-medium text-text-primary">
          {order.customerName ?? t('orders.guest')}
        </span>
        {/* Passerelle vers la fiche : le vendeur voit l'historique complet
            de l'acheteur sans repasser par la liste. */}
        <Link
          to="/customers/$customerId"
          params={{ customerId }}
          className="text-brand-primary hover:underline"
        >
          {t('orders.detail.viewCustomer')}
        </Link>
      </div>
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-md" aria-busy="true">
      <span className="sr-only">Chargement…</span>
      <div className="h-16 animate-pulse rounded-lg bg-surface-sunken" />
      <div className="grid grid-cols-1 gap-md xl:grid-cols-[3fr_2fr]">
        <div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />
        <div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />
      </div>
    </div>
  )
}
