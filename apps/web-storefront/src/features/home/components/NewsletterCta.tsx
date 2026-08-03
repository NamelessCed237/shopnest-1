import { useState, type FormEvent } from 'react'
import { useTranslation } from '@shopnest/i18n/react'

export function NewsletterCta() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    // TODO(#7): brancher l'endpoint d'inscription. En mode démonstration, aucune
    // donnée personnelle ne quitte le navigateur.
    setSubmitted(true)
  }

  return (
    <section className="overflow-hidden rounded-lg bg-[#0f172a] p-lg text-white md:p-xl">
      <div className="grid gap-lg md:grid-cols-[3fr_2fr] md:items-center">
        <div className="flex flex-col gap-sm">
          <h2 className="text-2xl font-bold">{t('storefront.newsletter.title')}</h2>
          <p className="max-w-md text-sm text-white/70">{t('storefront.newsletter.body')}</p>

          {submitted ? (
            <p role="status" className="text-sm font-medium text-status-success">
              {t('storefront.newsletter.success')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-sm">
              <label htmlFor="newsletter-email" className="sr-only">
                {t('storefront.newsletter.emailLabel')}
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('storefront.newsletter.placeholder')}
                className="min-w-56 flex-1 rounded-md border border-white/20 bg-white/10 px-md py-sm text-sm text-white outline-none placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white"
              />
              <button
                type="submit"
                className="rounded-md bg-brand-primary px-lg py-sm text-sm font-medium text-brand-onPrimary outline-none transition-colors hover:bg-brand-primaryHover focus-visible:ring-2 focus-visible:ring-white"
              >
                {t('storefront.newsletter.submit')}
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col items-center gap-sm rounded-lg border border-white/15 bg-white/5 p-md">
          <div className="flex flex-wrap justify-center gap-sm">
            <PaymentChip label={t('storefront.newsletter.mobileMoney')} />
            <PaymentChip label={t('storefront.newsletter.cards')} />
          </div>
          <p className="text-xs text-white/60">{t('storefront.newsletter.trust')}</p>
          <p className="flex items-center gap-xs text-xs text-white/60">
            <span aria-hidden="true">🔒</span>
            {t('storefront.newsletter.pci')}
          </p>
        </div>
      </div>
    </section>
  )
}

function PaymentChip({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-white px-md py-xs text-xs font-bold uppercase tracking-wide text-[#0f172a]">
      {label}
    </span>
  )
}
