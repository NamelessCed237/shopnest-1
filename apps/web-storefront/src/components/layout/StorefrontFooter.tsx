import { useTranslation } from '@shopnest/i18n/react'

const COLUMNS = [
  {
    key: 'platform',
    links: ['sellOnShopnest', 'marketplace', 'partnerProgram'],
  },
  {
    key: 'company',
    links: ['about', 'contact', 'privacy'],
  },
  {
    key: 'legal',
    links: ['terms', 'returns', 'shipping'],
  },
] as const

export function StorefrontFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border-base bg-surface-raised">
      <div className="mx-auto grid max-w-7xl gap-lg px-md py-xl md:grid-cols-[2fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-sm">
          <span className="text-lg font-bold text-text-primary">ShopNest</span>
          <p className="max-w-xs text-sm text-text-secondary">{t('storefront.footer.tagline')}</p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.key} aria-label={t(`storefront.footer.${column.key}`)}>
            <h2 className="mb-sm text-xs font-semibold uppercase tracking-widest text-text-secondary">
              {t(`storefront.footer.${column.key}`)}
            </h2>
            <ul className="flex flex-col gap-xs text-sm">
              {column.links.map((link) => (
                <li key={link}>
                  <a href={`/${link}`} className="text-text-secondary hover:text-text-primary">
                    {t(`storefront.footer.link.${link}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border-base">
        <p className="mx-auto max-w-7xl px-md py-md text-xs text-text-secondary">
          {t('storefront.footer.copyright', { year })}
        </p>
      </div>
    </footer>
  )
}
