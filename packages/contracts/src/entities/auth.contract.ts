import { z } from 'zod'
import { TOKEN_AUDIENCES, USER_ROLES } from './tenant.contract.js'

/** Politique de mot de passe — appliquée côté serveur ET côté formulaire (DRY). */
export const PasswordSchema = z
  .string()
  .min(12, 'errors.auth.passwordTooShort')
  .max(128)
  .regex(/[a-z]/, 'errors.auth.passwordNeedsLower')
  .regex(/[A-Z]/, 'errors.auth.passwordNeedsUpper')
  .regex(/\d/, 'errors.auth.passwordNeedsDigit')

export const LoginSchema = z.object({
  email: z.string().email('errors.auth.invalidEmail').toLowerCase().trim(),
  password: z.string().min(1),
  /** Obligatoire pour un super admin — doc/03 §5, MFA sans exception. */
  mfaCode: z.string().length(6).optional(),
})
export type LoginInput = z.infer<typeof LoginSchema>

export const RegisterCustomerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: PasswordSchema,
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
})
export type RegisterCustomerInput = z.infer<typeof RegisterCustomerSchema>

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshInput = z.infer<typeof RefreshSchema>

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Durée de vie de l'access token, en secondes. */
  expiresIn: z.number().int(),
})
export type TokenPair = z.infer<typeof TokenPairSchema>

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  audience: z.enum(TOKEN_AUDIENCES),
  tenantId: z.string().uuid().optional(),
})
export type SessionUser = z.infer<typeof SessionUserSchema>

export const LoginResponseSchema = TokenPairSchema.extend({
  user: SessionUserSchema,
})
export type LoginResponse = z.infer<typeof LoginResponseSchema>

/**
 * doc/03 §5 — durées de vie par audience.
 * Source unique : le backend signe avec, les clients planifient le refresh avec.
 */
export const TOKEN_TTL = {
  customer: { accessSeconds: 15 * 60, refreshSeconds: 30 * 24 * 3600 },
  tenant: { accessSeconds: 15 * 60, refreshSeconds: 7 * 24 * 3600 },
  admin: { accessSeconds: 10 * 60, refreshSeconds: 24 * 3600 },
} as const
