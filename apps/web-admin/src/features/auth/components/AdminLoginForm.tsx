import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoginSchema, type AppError, type LoginInput } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, TextInput } from '@shopnest/ui-web'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSessionStore } from '../model/session.store'

/**
 * doc/03 §5 — un super-admin ne se connecte JAMAIS sans MFA.
 *
 * Le code à six chiffres est donc un champ obligatoire de ce formulaire, alors
 * que le contrat le déclare optionnel : il l'est pour un vendeur, pas ici. La
 * règle est aussi appliquée côté serveur, qui rejette une connexion admin sans
 * code valide — ce formulaire ne fait qu'éviter un aller-retour inutile.
 */
export function AdminLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const signIn = useSessionStore((state) => state.signIn)

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', mfaCode: '' },
  })

  const mutation = useMutation<Awaited<ReturnType<typeof api.auth.loginSuperAdmin>>, AppError, LoginInput>({
    mutationFn: (input) => api.auth.loginSuperAdmin(input),
    onSuccess: (response) => {
      signIn(response.user, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      })
      onSuccess()
    },
  })

  // Erreurs par champ renvoyées par l'API (code MFA invalide) : replacées sous
  // le champ concerné plutôt qu'en bandeau générique.
  useEffect(() => {
    const fields = mutation.error?.fields
    if (!fields) return
    for (const [field, messageKey] of Object.entries(fields)) {
      form.setError(field as keyof LoginInput, { message: t(messageKey) })
    }
  }, [mutation.error, form, t])

  const fieldError = (field: keyof LoginInput) => {
    const message = form.formState.errors[field]?.message
    return message ? t(String(message)) : undefined
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="flex flex-col gap-md"
    >
      {mutation.error && !mutation.error.fields && (
        <Alert
          variant="danger"
          traceId={mutation.error.code === 'INTERNAL' ? mutation.error.traceId : undefined}
        >
          {t(mutation.error.userMessageKey)}
        </Alert>
      )}

      <TextInput
        label={t('auth.emailLabel')}
        type="email"
        autoComplete="username"
        required
        error={fieldError('email')}
        {...form.register('email')}
      />

      <TextInput
        label={t('auth.passwordLabel')}
        type="password"
        autoComplete="current-password"
        revealable
        required
        error={fieldError('password')}
        {...form.register('password')}
      />

      <TextInput
        label={t('admin.auth.mfaCode')}
        helperText={t('admin.auth.mfaHint')}
        // `one-time-code` : c'est ce qui permet au gestionnaire de mots de passe
        // et à iOS de proposer le code automatiquement.
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
        required
        error={fieldError('mfaCode')}
        {...form.register('mfaCode')}
      />

      <Button type="submit" loading={mutation.isPending}>
        {t('auth.signIn')}
      </Button>
    </form>
  )
}
