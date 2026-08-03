import { Link } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { PLAN_LIMITS, type PlanCode } from '@shopnest/contracts'
import { Badge, Card } from '@shopnest/ui-web'
import { PreferencesControls } from '@/components/layout/PreferencesControls'

/**
 * Page d'accueil publique du back-office.
 *
 * C'est le premier écran d'un visiteur non connecté : il présente l'offre et
 * mène à la connexion. Un formulaire de connexion nu comme point d'entrée ne
 * dit rien de ce qu'est le produit.
 */
export function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-surface-raised">
      <header className="border-b border-border-base bg-surface-base">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-md px-md py-sm">
          <span className="flex items-center gap-sm text-lg font-semibold text-text-primary">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-md bg-brand-primary text-sm font-bold text-brand-onPrimary"
            >
              S
            </span>
            ShopNest
          </span>

          <div className="flex items-center gap-md">
            <PreferencesControls />
            <Link
              to="/login"
              className="rounded-md bg-brand-primary px-md py-sm text-sm font-medium text-brand-onPrimary outline-none hover:bg-brand-primaryHover focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {t('landing.signIn')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-xl px-md py-xl">
        <section className="flex flex-col items-start gap-md">
          <Badge variant="success">{t('landing.badge')}</Badge>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-text-primary md:text-4xl">
            {t('landing.title')}
          </h1>
          <p className="max-w-2xl text-base text-text-secondary">{t('landing.subtitle')}</p>

          <div className="flex flex-wrap gap-sm">
            <Link
              to="/login"
              className="rounded-md bg-brand-primary px-lg py-sm text-sm font-medium text-brand-onPrimary outline-none hover:bg-brand-primaryHover focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {t('landing.primaryCta')}
            </Link>
            <a
              href="http://localhost:5173"
              className="rounded-md border border-border-base px-lg py-sm text-sm font-medium text-text-primary outline-none hover:bg-surface-base focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {t('landing.secondaryCta')}
            </a>
          </div>
        </section>

        <section aria-labelledby="landing-features">
          <h2 id="landing-features" className="mb-md text-xl font-semibold text-text-primary">
            {t('landing.features.title')}
          </h2>

          <div className="grid gap-md md:grid-cols-3">
            {(['payments', 'multiplatform', 'noMaintenance'] as const).map((feature) => (
              <Card key={feature} title={t(`landing.features.${feature}.title`)}>
                <p className="text-sm text-text-secondary">
                  {t(`landing.features.${feature}.body`)}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="landing-plans">
          <h2 id="landing-plans" className="mb-md text-xl font-semibold text-text-primary">
            {t('landing.plans.title')}
          </h2>

          <div className="grid gap-md md:grid-cols-3">
            {(Object.keys(PLAN_LIMITS) as PlanCode[]).map((plan) => (
              <PlanCard key={plan} plan={plan} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border-base">
        <p className="mx-auto max-w-6xl px-md py-md text-xs text-text-secondary">
          {t('storefront.footer.copyright', { year: new Date().getFullYear() })}
        </p>
      </footer>
    </div>
  )
}

function PlanCard({ plan }: { plan: PlanCode }) {
  const { t, number, locale } = useTranslation()
  const limits = PLAN_LIMITS[plan]

  return (
    <Card title={t(`landing.plans.${plan}`)}>
      <ul className="flex flex-col gap-xs text-sm text-text-secondary">
        {/*
          Les limites viennent de PLAN_LIMITS, jamais recopiées : la page tarifs
          et le contrôle de quota du backend ne peuvent pas se contredire
          (doc/02 §1.2).
        */}
        <li>
          {limits.maxProducts === Number.POSITIVE_INFINITY
            ? t('landing.plans.unlimitedProducts')
            : t('landing.plans.maxProducts', { count: number(limits.maxProducts) })}
        </li>
        <li>
          {limits.transactionFeeRate === null
            ? t('landing.plans.negotiatedFee')
            : // Séparateur décimal selon la langue : « 2,5 % » en français,
              // « 2.5% » en anglais. Le figer en fr-FR produit un texte hybride.
              t('landing.plans.fee', {
                rate: (limits.transactionFeeRate * 100).toLocaleString(locale),
              })}
        </li>
        {limits.customDomain && <li>{t('landing.plans.customDomain')}</li>}
        {limits.bankTransfer && <li>{t('landing.plans.bankTransfer')}</li>}
      </ul>
    </Card>
  )
}
