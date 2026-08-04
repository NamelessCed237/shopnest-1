import { useEffect, useState } from 'react'
import {
  TENANT_THEME_MODES,
  type AdminTenant,
  type TenantTheme,
  type TenantThemeMode,
} from '@shopnest/contracts'
import {
  brandPaletteToCssVars,
  contrastRatio,
  deriveBrandPalette,
  isHexColor,
} from '@shopnest/tokens'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, Dropdown, Icon, TextInput } from '@shopnest/ui-web'
import { useUpdateTenantTheme } from '../api/use-tenants'

/** Couleur retenue quand la boutique n'en a pas choisi — l'émeraude du produit. */
const DEFAULT_BRAND = '#047857'

/**
 * Thème par défaut d'une boutique, réglé depuis l'administration.
 *
 * UNE couleur suffit : le survol, le fond discret et la couleur du texte posé
 * dessus sont dérivés par `deriveBrandPalette`. Demander les quatre produirait
 * des combinaisons illisibles, puisque personne ne vérifie un contraste à l'œil.
 */
export function ThemeEditor({ tenant }: { tenant: AdminTenant }) {
  const { t } = useTranslation()
  const mutation = useUpdateTenantTheme(tenant.id)

  const [brand, setBrand] = useState(tenant.theme.brandPrimary ?? DEFAULT_BRAND)
  const [mode, setMode] = useState<TenantThemeMode>(tenant.theme.defaultMode)
  const [logoUrl, setLogoUrl] = useState(tenant.theme.logoUrl ?? '')

  // Recalage si la boutique change (navigation d'une fiche à l'autre) ou après
  // enregistrement : `useState` ne relit pas sa valeur initiale.
  useEffect(() => {
    setBrand(tenant.theme.brandPrimary ?? DEFAULT_BRAND)
    setMode(tenant.theme.defaultMode)
    setLogoUrl(tenant.theme.logoUrl ?? '')
  }, [tenant.id, tenant.theme.brandPrimary, tenant.theme.defaultMode, tenant.theme.logoUrl])

  const valid = isHexColor(brand)
  const palette = valid ? deriveBrandPalette(brand, mode === 'dark' ? 'dark' : 'light') : undefined

  const dirty =
    brand !== (tenant.theme.brandPrimary ?? DEFAULT_BRAND) ||
    mode !== tenant.theme.defaultMode ||
    logoUrl !== (tenant.theme.logoUrl ?? '')

  const submit = () => {
    const theme: TenantTheme = {
      brandPrimary: brand,
      defaultMode: mode,
      // Champ vidé : on OMET la clé plutôt que d'envoyer une chaîne vide, que
      // la validation d'URL rejetterait.
      ...(logoUrl ? { logoUrl } : {}),
    }
    mutation.mutate(theme)
  }

  return (
    <Card title={t('admin.theme.title')} description={t('admin.theme.hint')}>
      <div className="flex flex-col gap-lg">
        {mutation.isSuccess && !mutation.isPending && !dirty && (
          <Alert variant="success">{t('admin.theme.saved')}</Alert>
        )}

        {mutation.error && (
          <Alert
            variant="danger"
            traceId={mutation.error.code === 'INTERNAL' ? mutation.error.traceId : undefined}
          >
            {t(mutation.error.userMessageKey)}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
          <div className="flex flex-col gap-md">
            <ColorField value={brand} onChange={setBrand} invalid={!valid} />

            <Dropdown<TenantThemeMode>
              label={t('admin.theme.defaultMode')}
              helperText={t('admin.theme.defaultModeHint')}
              source={TENANT_THEME_MODES.map((option) => ({
                value: option,
                label: t(`admin.theme.mode.${option}`),
              }))}
              value={mode}
              onChange={(next) => next && setMode(next)}
            />

            <TextInput
              label={t('admin.theme.logoUrl')}
              helperText={t('admin.theme.logoUrlHint')}
              type="url"
              placeholder="https://…"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </div>

          {palette ? (
            <Preview palette={palette} mode={mode} />
          ) : (
            <Alert variant="warning">{t('errors.tenant.invalidColor')}</Alert>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} loading={mutation.isPending} disabled={!dirty || !valid}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

/**
 * Sélecteur natif + saisie hexadécimale, côte à côte.
 *
 * Le sélecteur natif seul empêche de coller une couleur de charte donnée par un
 * client ; le champ texte seul oblige à connaître son code hexadécimal. Les
 * deux pilotent la même valeur.
 */
function ColorField({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  invalid: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-xs">
      <span className="text-sm font-medium text-text-primary">{t('admin.theme.brandColor')}</span>
      <div className="flex items-center gap-sm">
        <input
          type="color"
          aria-label={t('admin.theme.brandColorPicker')}
          value={isHexColor(value) ? value : DEFAULT_BRAND}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border border-border-base bg-surface-base p-[2px]"
        />
        <div className="flex-1">
          <TextInput
            aria-label={t('admin.theme.brandColor')}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            error={invalid ? t('errors.tenant.invalidColor') : undefined}
            placeholder="#047857"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Aperçu RÉEL, pas une pastille de couleur.
 *
 * Les variables CSS de marque sont surchargées sur ce bloc uniquement : les
 * composants qui s'y trouvent — bouton, badge, lien — prennent donc la couleur
 * choisie exactement comme ils le feront dans la boutique. Une pastille isolée
 * ne dirait rien de la lisibilité du texte posé dessus.
 */
function Preview({
  palette,
  mode,
}: {
  palette: ReturnType<typeof deriveBrandPalette>
  mode: TenantThemeMode
}) {
  const { t } = useTranslation()

  const contrast = contrastRatio(palette.primary, palette.onPrimary)
  // 4,5:1 est le seuil AA pour du texte normal. En dessous, le libellé d'un
  // bouton devient pénible à lire — on le dit plutôt que de laisser passer.
  const readable = contrast >= 4.5

  return (
    <div
      style={brandPaletteToCssVars(palette) as React.CSSProperties}
      className="flex flex-col gap-md rounded-lg border border-border-base bg-surface-raised p-md"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {t('admin.theme.preview')} · {t(`admin.theme.mode.${mode}`)}
      </span>

      <div className="flex flex-wrap items-center gap-sm">
        <span className="rounded-md bg-brand-primary px-md py-sm text-sm font-medium text-brand-onPrimary">
          {t('admin.theme.previewButton')}
        </span>
        <span className="rounded-full bg-brand-primarySubtle px-sm py-xs text-xs font-medium text-brand-primary">
          {t('admin.theme.previewBadge')}
        </span>
        <span className="text-sm font-medium text-brand-primary underline">
          {t('admin.theme.previewLink')}
        </span>
      </div>

      <p
        className={`flex items-center gap-xs text-xs ${
          readable ? 'text-text-secondary' : 'text-status-warning'
        }`}
      >
        <Icon name={readable ? 'check' : 'info'} size="sm" />
        {t('admin.theme.contrast', { ratio: contrast.toFixed(1).replace('.', ',') })}
      </p>
    </div>
  )
}
