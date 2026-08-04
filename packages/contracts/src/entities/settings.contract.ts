import { z } from 'zod'
import { TenantSchema, USER_ROLES } from './tenant.contract.js'

/**
 * Écran PARAMÈTRES — profil de la boutique et équipe.
 *
 * Le profil réutilise `TenantSchema` : la boutique est déjà décrite une fois,
 * la redécrire ici ferait diverger les deux au premier champ ajouté.
 */
export const TenantSettingsSchema = TenantSchema
export type TenantSettings = z.infer<typeof TenantSettingsSchema>

/**
 * Champs MODIFIABLES par le vendeur — et eux seuls.
 *
 * `slug`, `planCode`, `status` et `defaultCurrency` en sont absents
 * volontairement : changer un slug casse les URL de la boutique et les liens
 * déjà partagés, changer une devise réinterpréterait tout l'historique de
 * commandes. Ces opérations existent, mais relèvent du support, pas d'un
 * formulaire libre.
 */
export const UpdateTenantSettingsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  /**
   * `null` retire le domaine, `undefined` ne le touche pas. La distinction est
   * portée par le contrat parce qu'elle change le comportement du serveur —
   * un `.optional()` seul rendrait la suppression impossible à exprimer.
   */
  customDomain: z
    .string()
    .max(253)
    .regex(
      /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
      'errors.tenant.invalidDomain',
    )
    .nullable()
    .optional(),
})
export type UpdateTenantSettingsInput = z.infer<typeof UpdateTenantSettingsSchema>

export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  createdAt: z.string().datetime(),
})
export type TeamMember = z.infer<typeof TeamMemberSchema>
