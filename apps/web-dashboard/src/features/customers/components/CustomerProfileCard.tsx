import type { CustomerSummary } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Card } from '@shopnest/ui-web'
import { customerDisplayName } from '@/lib/fake/customers.fixtures'
import { CustomerSegmentBadge } from './CustomerSegmentBadge'

export function CustomerProfileCard({ customer }: { customer: CustomerSummary }) {
  const { t, date } = useTranslation()
  const name = customerDisplayName(customer)

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-md">
        <span
          aria-hidden="true"
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-primarySubtle text-lg font-semibold text-brand-primary"
        >
          {initials(name)}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <h2 className="text-lg font-semibold text-text-primary">{name}</h2>
            <CustomerSegmentBadge segment={customer.segment} />
          </div>

          <dl className="grid gap-x-lg gap-y-xs text-sm sm:grid-cols-2">
            <Field label={t('customers.detail.email')}>
              {/* Lien mailto : le vendeur contacte son client sans copier-coller. */}
              <a href={`mailto:${customer.email}`} className="text-brand-primary hover:underline">
                {customer.email}
              </a>
            </Field>

            <Field label={t('customers.detail.phone')}>
              {customer.phone ? (
                <a href={`tel:${customer.phone}`} className="text-brand-primary hover:underline">
                  {customer.phone}
                </a>
              ) : (
                <span className="text-text-disabled">{t('customers.detail.noPhone')}</span>
              )}
            </Field>

            <Field label={t('customers.detail.memberSince')}>{date(customer.createdAt)}</Field>

            <Field label={t('customers.detail.firstOrder')}>
              {customer.firstOrderAt ? (
                date(customer.firstOrderAt)
              ) : (
                <span className="text-text-disabled">{t('customers.noOrder')}</span>
              )}
            </Field>
          </dl>
        </div>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="text-text-primary">{children}</dd>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}
