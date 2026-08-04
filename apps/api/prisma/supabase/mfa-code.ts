import { PrismaClient } from '@prisma/client'
import { authenticator } from 'otplib'

/**
 * Affiche le code MFA courant du super-admin.
 *
 * Le seed imprime le SECRET une fois, à sa création ; il faut ensuite une
 * application d'authentification pour en tirer un code toutes les 30 secondes.
 * En développement, c'est un obstacle disproportionné : on ne va pas enrôler un
 * téléphone pour ouvrir un back-office local.
 *
 * Ce script lit le secret en base et calcule le code. Il ne l'affaiblit pas :
 * le secret vient de la même base que le mot de passe, et quiconque peut lancer
 * ce script a déjà la main sur `DIRECT_URL`.
 *
 *   pnpm --filter @shopnest/api mfa:code
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error('mfa:code est un utilitaire de développement.')
}

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

async function main(): Promise<void> {
  const admin = await prisma.superAdmin.findFirst({
    where: { mfaSecret: { not: null } },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin?.mfaSecret) {
    throw new Error('Aucun super-admin avec MFA. Lancer `pnpm --filter @shopnest/api db:seed`.')
  }

  const code = authenticator.generate(admin.mfaSecret)
  const remaining = authenticator.timeRemaining()

  console.warn(`
  ${admin.email}
  Code : ${code}   (valide encore ${remaining} s)

  Le code change toutes les 30 secondes : s'il en reste moins de 5,
  relancez la commande plutôt que de risquer une expiration en route.
`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
