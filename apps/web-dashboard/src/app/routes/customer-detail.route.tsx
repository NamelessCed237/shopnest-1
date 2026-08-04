import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, Icon, StatTile } from '@shopnest/ui-web'
import {
  CustomerOrderHistory,
  CustomerProfileCard,
  useCustomer,
} from '@/features/customers'

export function CustomerDetailPage() {
  const { t, money, number, date } = useTranslation()
  const navigate = useNavigate()
  const { customerId } = useParams({ from: '/authenticated/customers/$customerId' })
  const query = useCustomer(customerId)

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <Link to="/customers" className="text-sm text-brand-primary hover:underline">
          <Icon name="arrow-left" /> {t('customers.detail.back')}
        </Link>
      </div>

      {/* Les quatre états, ici aussi (doc/04 §7). */}
      {query.isPending && <ProfileSkeleton />}

      {query.isError && (
        <Card>
          <div className="flex flex-col items-start gap-md">
            <Alert
              variant="danger"
              traceId={query.error.code === 'INTERNAL' ? query.error.traceId : undefined}
            >
              {t(query.error.userMessageKey)}
            </Alert>

            {/* Une fiche introuvable n'est pas une panne : on ne propose pas
                « Réessayer », on ramène à la liste. */}
            {query.error.code === 'NOT_FOUND' ? (
              <Link to="/customers">
                <Button variant="secondary">{t('customers.detail.back')}</Button>
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
          <CustomerProfileCard customer={query.data} />

          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t('customers.columns.totalSpent')}
              value={money(query.data.totalSpent)}
              hint={t('customers.detail.settledOnly')}
            />
            <StatTile
              label={t('customers.columns.orders')}
              value={number(query.data.orderCount)}
            />
            <StatTile
              label={t('dashboard.kpi.averageOrderValue')}
              value={money(query.data.averageOrderValue)}
            />
            <StatTile
              label={t('customers.columns.lastOrder')}
              value={query.data.lastOrderAt ? date(query.data.lastOrderAt) : t('customers.noOrder')}
            />
          </div>

          <CustomerOrderHistory
            customerId={query.data.id}
            onOpenOrder={(orderId) => void navigate({ to: '/orders/$orderId', params: { orderId } })}
          />
        </>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-md" aria-busy="true">
      <span className="sr-only">Chargement…</span>
      <div className="h-32 animate-pulse rounded-lg bg-surface-sunken" />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-sunken" />
        ))}
      </div>
    </div>
  )
}
