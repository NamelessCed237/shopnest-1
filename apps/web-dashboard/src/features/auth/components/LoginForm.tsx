import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoginSchema, type LoginInput } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, TextInput } from '@shopnest/ui-web'
import { useLogin } from '../api/use-login'

/**
 * doc/04 §5 — un seul schéma Zod, celui de @shopnest/contracts, partagé avec le
 * backend. Une règle de validation change à un seul endroit.
 */
export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const login = useLogin()

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
    // Validation à la soumission, puis au blur une fois le champ touché.
    // Valider à chaque frappe affiche « email invalide » après 3 caractères : hostile.
    mode: 'onTouched',
  })

  // Les erreurs par champ renvoyées par l'API sont réinjectées dans le formulaire.
  useEffect(() => {
    const fields = login.error?.fields
    if (!fields) return
    for (const [name, messageKey] of Object.entries(fields)) {
      form.setError(name as keyof LoginInput, { message: t(messageKey) })
    }
  }, [login.error, form, t])

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, { onSuccess })
  })

  const globalError = login.error && !login.error.fields ? login.error : undefined

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
      {globalError && (
        <Alert
          variant="danger"
          traceId={globalError.code === 'INTERNAL' ? globalError.traceId : undefined}
        >
          {t(globalError.userMessageKey)}
        </Alert>
      )}

      <TextInput
        label={t('auth.emailLabel')}
        type="email"
        autoComplete="username"
        autoFocus
        required
        error={form.formState.errors.email && t(form.formState.errors.email.message ?? '')}
        {...form.register('email')}
      />

      <TextInput
        label={t('auth.passwordLabel')}
        type="password"
        autoComplete="current-password"
        revealable
        required
        error={form.formState.errors.password && t(form.formState.errors.password.message ?? '')}
        {...form.register('password')}
      />

      <Button type="submit" size="lg" fullWidth loading={login.isPending}>
        {t('auth.signIn')}
      </Button>
    </form>
  )
}
