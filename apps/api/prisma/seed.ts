import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'
import { authenticator } from 'otplib'

/**
 * doc/03 §4 — le seed crée DEUX tenants avec des données croisées.
 * Il ne sert pas qu'au développement : c'est la fixture des tests d'isolation
 * (doc/08 §3). Un seul tenant ne permettrait pas de détecter une fuite.
 */
const prisma = new PrismaClient()

const ARGON2ID = 2
const hashOptions = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 }

const DEV_PASSWORD = 'MotDePasseDev123'

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed ne doit jamais être exécuté en production.')
  }

  const passwordHash = await hash(DEV_PASSWORD, hashOptions)

  const alpha = await prisma.tenant.upsert({
    where: { slug: 'alpha-electronics' },
    update: {},
    create: {
      slug: 'alpha-electronics',
      name: 'Alpha Electronics',
      status: 'active',
      planCode: 'pro',
      countryCode: 'CM',
      defaultCurrency: 'XAF',
    },
  })

  const beta = await prisma.tenant.upsert({
    where: { slug: 'beta-mode' },
    update: {},
    create: {
      slug: 'beta-mode',
      name: 'Beta Mode',
      status: 'active',
      planCode: 'basic',
      countryCode: 'FR',
      defaultCurrency: 'EUR',
    },
  })

  for (const [tenant, prefix, currency] of [
    [alpha, 'alpha', 'XAF'],
    [beta, 'beta', 'EUR'],
  ] as const) {
    await prisma.tenantUser.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: `admin@${prefix}.test` } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: `admin@${prefix}.test`,
        passwordHash,
        role: 'tenant_admin',
      },
    })

    await prisma.customer.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: `client@${prefix}.test` } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: `client@${prefix}.test`,
        passwordHash,
        firstName: 'Client',
        lastName: prefix,
      },
    })

    await prisma.product.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        tenantId: tenant.id,
        slug: `${prefix}-produit-${i + 1}`,
        name: `${tenant.name} — Produit ${i + 1}`,
        priceCents: (i + 1) * 1000,
        currency,
        status: 'active',
        stock: 10 * (i + 1),
        imageUrls: [],
      })),
      skipDuplicates: true,
    })
  }

  // doc/03 §5 — un super admin sans MFA ne peut pas se connecter : on le configure
  // dès le seed, sinon le compte de développement serait inutilisable.
  const mfaSecret = authenticator.generateSecret()
  const admin = await prisma.superAdmin.upsert({
    where: { email: 'admin@shopnest.test' },
    update: { mfaSecret },
    create: { email: 'admin@shopnest.test', passwordHash, mfaSecret },
  })

  console.warn(`
Seed terminé.

  Tenants   : ${alpha.slug}, ${beta.slug} — 5 produits chacun
  Vendeurs  : admin@alpha.test, admin@beta.test
  Acheteurs : client@alpha.test, client@beta.test
  Admin     : ${admin.email}
  Mot de passe (dev uniquement) : ${DEV_PASSWORD}

  Secret TOTP du super admin — à saisir dans une app d'authentification :
  ${mfaSecret}
`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
