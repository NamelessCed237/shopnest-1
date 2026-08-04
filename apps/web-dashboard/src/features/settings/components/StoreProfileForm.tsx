import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  PLAN_LIMITS,
  UpdateTenantSettingsSchema,
  type TenantSettings,
  type UpdateTenantSettingsInput,
} from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, TextInput } from '@shopnest/ui-web'
import { useUpdateTenantSettings } from '../api/use-settings'

/**
 * doc/04 §5 — UN SEUL schéma Zod, celui de @shopnest/contracts, partagé avec le
 * backend. Le formulaire ne redéfinit ni le format de domaine, ni les longueurs.
 */
export function StoreProfileForm({ settings }: { settings: TenantSettings }) {
  const { t } = useTranslation()
  const mutation = useUpdateTenantSettings()

  const domainAllowed = PLAN_LIMITS[settings.planCode].customDomain

  const form = useForm<UpdateTenantSettingsInput>({
    resolver: zodResolver(UpdateTenantSettingsSchema),
    mode: 'onTouched',
    defaultValues: { name: settings.name, customDomain: settings.customDomain ?? '' },
  })

  const { register, handleSubmit, formState, setError, reset } = form

  // Recalage après enregistrement : le serveur peut normaliser une valeur, et
  // le formulaire doit refléter ce qui a RÉELLEMENT été retenu.
  useEffect(() => {
    reset({ name: settings.name, customDomain: settings.customDomain ?? '' })
  }, [settings.name, settings.customDomain, reset])

  // Erreurs par champ renvoyées par l'API (domaine déjà pris, plan insuffisant)
  // replacées sous le champ concerné plutôt qu'en bandeau générique.
  useEffect(() => {
    const fields = mutation.error?.fields
    if (!fields) return
    for (const [field, messageKey] of Object.entries(fields)) {
      setError(field as keyof UpdateTenantSettingsInput, { message: t(messageKey) })
    }
  }, [mutation.error, setError, t])

  const fieldError = (field: keyof UpdateTenantSettingsInput) => {
    const message = formState.errors[field]?.message
    return message ? t(String(message)) : undefined
  }

  const submit = handleSubmit((values) => {
    mutation.mutate({
      name: values.name,
      /*
       * Champ vidé → `null`, qui SUPPRIME le domaine côté serveur.
       *
       * Envoyer la chaîne vide échouerait à la validation de format, et ne rien
       * envoyer signifierait « ne change pas » : l'utilisateur ne pourrait
       * jamais retirer un domaine une fois posé.
       */
      customDomain: values.customDomain ? values.customDomain : null,
    })
  })

  return (
    <Card title={t('settings.profile.title')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-md">
        {mutation.isSuccess && !mutation.isPending && (
          <Alert variant="success">{t('settings.profile.saved')}</Alert>
        )}

        {/* Erreur globale : panne réseau, droits insuffisants. */}
        {mutation.error && !mutation.error.fields && (
          <Alert
            variant="danger"
            traceId={mutation.error.code === 'INTERNAL' ? mutation.error.traceId : undefined}
          >
            {t(mutation.error.userMessageKey)}
          </Alert>
        )}

        <TextInput
          label={t('settings.profile.name')}
          helperText={t('settings.profile.nameHint')}
          error={fieldError('name')}
          required
          {...register('name')}
        />

        <TextInput
          label={t('settings.profile.customDomain')}
          helperText={
            domainAllowed
              ? t('settings.profile.customDomainHint')
              : t('settings.profile.customDomainLocked')
          }
          error={fieldError('customDomain')}
          placeholder="boutique.com"
          /*
           * Désactivé hors plan Pro — mais le serveur refuse de toute façon
           * (SettingsService). Un champ grisé est une commodité, jamais une
           * protection : un client modifié n'a que faire d'un `disabled`.
           */
          disabled={!domainAllowed}
          {...register('customDomain')}
        />

        {/*
          Adresse, pays et devise sont AFFICHÉS mais non modifiables : changer un
          slug casse les liens déjà partagés, changer une devise réinterpréterait
          tout l'historique de commandes. Les masquer laisserait croire qu'ils
          n'existent pas.
        */}
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <ReadOnly
            label={t('settings.profile.address')}
            value={`${settings.slug}.shopnest.app`}
            hint={t('settings.profile.addressHint')}
          />
          <ReadOnly label={t('settings.profile.country')} value={settings.countryCode} />
          <ReadOnly label={t('settings.profile.currency')} value={settings.defaultCurrency} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending} disabled={!formState.isDirty}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-xs">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <span className="rounded-md border border-border-base bg-surface-raised px-sm py-xs text-sm text-text-secondary">
        {value}
      </span>
      <span className="text-xs text-text-secondary">
        {hint ?? t('settings.profile.immutableHint')}
      </span>
    </div>
  )
}
