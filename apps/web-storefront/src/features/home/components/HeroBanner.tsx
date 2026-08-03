import { useTranslation } from '@shopnest/i18n/react'
import { MediaPlaceholder } from '@/components/media/MediaPlaceholder'

export function HeroBanner() {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden rounded-lg">
      <MediaPlaceholder tone="slate" label={t('storefront.hero.imageAlt')} className="min-h-72" />

      {/*
        Voile dégradé plutôt qu'un aplat : le texte reste lisible sur la partie
        sombre sans écraser complètement le visuel produit à droite.
        Contraste vérifié : texte blanc sur #1f2937 assombri → > 13:1.

        `to-r` et non `to-e` : Tailwind v3 n'a pas de directions logiques, et une
        classe inconnue ne produit AUCUN style — le voile disparaîtrait en silence
        et le titre blanc se retrouverait sur la photo nue.
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />

      <div className="absolute inset-0 flex flex-col justify-center gap-md p-lg md:max-w-xl md:p-xl">
        <span className="w-fit rounded-full bg-brand-primary px-sm py-xs text-xs font-bold uppercase tracking-widest text-brand-onPrimary">
          {t('storefront.hero.badge')}
        </span>

        <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
          {t('storefront.hero.title')}
        </h1>

        <p className="max-w-md text-sm text-white/80">{t('storefront.hero.subtitle')}</p>

        <div className="flex flex-wrap gap-sm">
          <a
            href="/products"
            className="rounded-md bg-brand-primary px-lg py-sm text-sm font-medium text-brand-onPrimary outline-none transition-colors hover:bg-brand-primaryHover focus-visible:ring-2 focus-visible:ring-white"
          >
            {t('storefront.hero.primaryCta')}
          </a>
          <a
            href="/products/featured"
            className="rounded-md border border-white/80 px-lg py-sm text-sm font-medium text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
          >
            {t('storefront.hero.secondaryCta')}
          </a>
        </div>
      </div>
    </section>
  )
}
