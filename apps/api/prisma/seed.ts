import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'
import { authenticator } from 'otplib'
import { PLAN_LIMITS, REVENUE_STATUSES } from '@shopnest/contracts'
import { ALPHA_CATALOG, BETA_CATALOG, slugFor, type SeedCatalog } from './seed/catalog'
import {
  IDENTITIES,
  METHOD_WEIGHTS,
  STATUS_WEIGHTS,
  daysAgo,
  makeRng,
  paymentStatusFor,
  slugify,
  weightedPick,
} from './seed/generators'

/**
 * doc/03 §4 — le seed crée DEUX tenants avec des données croisées.
 *
 * Il ne sert pas qu'au développement : c'est la fixture des tests d'isolation
 * (doc/08 §3). Un seul tenant ne permettrait pas de détecter une fuite.
 */
/**
 * Le seed passe par la connexion d'ADMINISTRATION, pas par le rôle applicatif.
 *
 * Deux raisons, toutes deux bloquantes :
 *
 *   1. La RLS est forcée sur les tables scopées. Le rôle applicatif ne peut
 *      insérer un produit que si `app.tenant_id` est positionné — or le seed
 *      crée justement les tenants auxquels ces produits appartiennent.
 *   2. Sur Supabase, `DATABASE_URL` vise le pooler en mode transaction, qui
 *      convient mal aux gros lots d'écritures d'un seed.
 *
 * `DIRECT_URL` est la même variable que celle des migrations : peupler une base
 * est une opération d'administration, au même titre que la faire évoluer.
 */
const adminUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!adminUrl) throw new Error('DIRECT_URL ou DATABASE_URL requis pour le seed.')

const prisma = new PrismaClient({ datasourceUrl: adminUrl })

const ARGON2ID = 2
const hashOptions = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 }

const DEV_PASSWORD = 'MotDePasseDev123'

/**
 * Date de référence des données générées.
 *
 * Figée à l'exécution plutôt qu'en dur : les tuiles du tableau de bord
 * regardent les 7, 30 et 90 derniers jours. Une date en dur ferait sortir tout
 * l'historique de la fenêtre au bout de quelques semaines, et les écrans
 * afficheraient zéro sans que rien ne soit cassé.
 */
const TODAY = new Date()

/**
 * L'historique dépasse volontairement la fenêtre du tableau de bord.
 *
 * Avec exactement 90 jours, aucun client ne peut devenir « dormant » : le
 * segment existerait dans le code sans jamais s'afficher, et le seuil ne serait
 * jamais exercé.
 */
const DAYS_SPAN = 240
const ORDERS_PER_TENANT = 140

interface SeedTenant {
  slug: string
  name: string
  planCode: 'basic' | 'pro' | 'enterprise'
  countryCode: string
  currency: string
  catalog: SeedCatalog
  /** Décale les tirages : les deux boutiques n'ont pas la même activité. */
  seed: number
}

const TENANTS: SeedTenant[] = [
  {
    slug: 'alpha-electronics',
    name: 'Alpha Electronics',
    planCode: 'pro',
    countryCode: 'CM',
    currency: 'XAF',
    catalog: ALPHA_CATALOG,
    seed: 13,
  },
  {
    slug: 'beta-mode',
    name: 'Beta Mode',
    planCode: 'basic',
    countryCode: 'FR',
    currency: 'EUR',
    catalog: BETA_CATALOG,
    seed: 7717,
  },
]

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed ne doit jamais être exécuté en production.')
  }

  const passwordHash = await hash(DEV_PASSWORD, hashOptions)

  for (const config of TENANTS) {
    const tenant = await upsertTenant(config)
    await resetDemoData(tenant.id)

    await seedStaff(tenant.id, config, passwordHash)
    const categoryIds = await seedCategories(tenant.id, config)
    const products = await seedProducts(tenant.id, config, categoryIds)
    const customerIds = await seedCustomers(tenant.id, config, passwordHash)
    await seedOrders(tenant.id, config, products, customerIds)
  }

  // doc/03 §5 — un super admin sans MFA ne peut pas se connecter : on le
  // configure dès le seed, sinon le compte de développement serait inutilisable.
  const mfaSecret = authenticator.generateSecret()
  const admin = await prisma.superAdmin.upsert({
    where: { email: 'admin@shopnest.test' },
    update: { mfaSecret },
    create: { email: 'admin@shopnest.test', passwordHash, mfaSecret },
  })

  await report(admin.email, mfaSecret)
}

async function upsertTenant(config: SeedTenant) {
  return prisma.tenant.upsert({
    where: { slug: config.slug },
    update: {},
    create: {
      slug: config.slug,
      name: config.name,
      status: 'active',
      planCode: config.planCode,
      countryCode: config.countryCode,
      defaultCurrency: config.currency,
    },
  })
}

/**
 * Efface les données de démonstration du tenant AVANT de les régénérer.
 *
 * Le seed doit être rejouable : sans cet effacement, chaque exécution
 * empilerait 140 commandes de plus et le chiffre d'affaires dériverait à chaque
 * lancement. On préfère cela à des `upsert` par ligne, qui laisseraient
 * survivre les enregistrements d'une version antérieure du catalogue.
 *
 * La portée est STRICTEMENT le tenant passé en argument : aucune requête ici
 * n'est globale.
 */
async function resetDemoData(tenantId: string): Promise<void> {
  // Ordre imposé par les clés étrangères : les feuilles d'abord.
  await prisma.payment.deleteMany({ where: { tenantId } })
  await prisma.orderItem.deleteMany({ where: { tenantId } })
  await prisma.order.deleteMany({ where: { tenantId } })
  await prisma.idempotencyKey.deleteMany({ where: { tenantId } })
  await prisma.customer.deleteMany({ where: { tenantId } })
  await prisma.productVariant.deleteMany({ where: { tenantId } })
  await prisma.product.deleteMany({ where: { tenantId } })
  await prisma.category.deleteMany({ where: { tenantId } })
}

async function seedStaff(
  tenantId: string,
  config: SeedTenant,
  passwordHash: string,
): Promise<void> {
  const prefix = config.slug.split('-')[0]!

  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId, email: `admin@${prefix}.test` } },
    update: {},
    create: { tenantId, email: `admin@${prefix}.test`, passwordHash, role: 'tenant_admin' },
  })

  // Un second compte, employé : c'est le seul moyen de vérifier de visu que les
  // actions réservées à l'administrateur (remboursement, suppression) sont bien
  // refusées. Le plan `basic` n'autorise qu'un utilisateur, on ne le crée donc
  // que là où PLAN_LIMITS le permet — le garde de quota refuserait sinon.
  if (PLAN_LIMITS[config.planCode].maxStaffUsers > 1) {
    await prisma.tenantUser.upsert({
      where: { tenantId_email: { tenantId, email: `vendeur@${prefix}.test` } },
      update: {},
      create: { tenantId, email: `vendeur@${prefix}.test`, passwordHash, role: 'tenant_staff' },
    })
  }
}

/** Renvoie le nom de catégorie → identifiant, pour rattacher les produits. */
async function seedCategories(
  tenantId: string,
  config: SeedTenant,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const [index, root] of config.catalog.categories.entries()) {
    const created = await prisma.category.create({
      data: {
        tenantId,
        slug: slugFor(root.name),
        name: root.name,
        description: root.description,
        position: index,
      },
    })
    ids.set(root.name, created.id)

    for (const [childIndex, child] of root.children.entries()) {
      const createdChild = await prisma.category.create({
        data: {
          tenantId,
          slug: slugFor(child),
          name: child,
          description: '',
          parentId: created.id,
          position: childIndex,
        },
      })
      ids.set(child, createdChild.id)
    }
  }

  return ids
}

interface SeededProduct {
  id: string
  name: string
  priceCents: number
}

async function seedProducts(
  tenantId: string,
  config: SeedTenant,
  categoryIds: Map<string, string>,
): Promise<SeededProduct[]> {
  const products: SeededProduct[] = []

  for (const item of config.catalog.products) {
    const categoryId = categoryIds.get(item.category)

    const created = await prisma.product.create({
      data: {
        tenantId,
        slug: slugFor(item.name),
        name: item.name,
        description: '',
        // Produit à variantes : le stock et le prix affichés sont la SOMME et
        // le MINIMUM des variantes (deriveStock / derivePrice). On les écrit
        // dès l'insertion pour que la base soit cohérente sans attendre une
        // première modification via l'API.
        priceCents: item.variants?.length
          ? Math.min(...item.variants.map((variant) => variant.price))
          : item.price,
        currency: config.currency,
        status: item.status,
        stock: item.variants?.length
          ? item.variants.reduce((sum, variant) => sum + variant.stock, 0)
          : item.stock,
        lowStockThreshold: item.lowStockThreshold,
        imageUrls: [],
        ...(categoryId ? { categories: { connect: { id: categoryId } } } : {}),
        ...(item.variants?.length
          ? {
              variants: {
                create: item.variants.map((variant) => ({
                  tenantId,
                  sku: `${slugify(item.name).slice(0, 12).toUpperCase()}-${slugify(variant.name).toUpperCase()}`,
                  name: variant.name,
                  priceCents: variant.price,
                  stock: variant.stock,
                  attributes: variant.attributes,
                })),
              },
            }
          : {}),
      },
    })

    // Les produits archivés ne sont pas vendables : les exclure de la source des
    // commandes évite un historique qui référencerait un article retiré avant
    // même d'avoir existé au catalogue.
    if (item.status === 'active') {
      products.push({ id: created.id, name: created.name, priceCents: created.priceCents })
    }
  }

  return products
}

async function seedCustomers(
  tenantId: string,
  config: SeedTenant,
  passwordHash: string,
): Promise<string[]> {
  const domain = config.slug.split('-')[0]!

  const rows = IDENTITIES.map(([firstName, lastName, phone, createdDaysAgo]) => ({
    tenantId,
    email: `${slugify(firstName)}.${slugify(lastName)}@${domain}.test`,
    // Un compte sur trois n'a pas de mot de passe : ce sont les commandes
    // passées en invité, un cas que la fiche client doit savoir afficher.
    passwordHash: createdDaysAgo % 3 === 0 ? null : passwordHash,
    phone,
    firstName,
    lastName,
    createdAt: daysAgo(TODAY, createdDaysAgo, createdDaysAgo),
  }))

  await prisma.customer.createMany({ data: rows })

  const created = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return created.map((customer) => customer.id)
}

async function seedOrders(
  tenantId: string,
  config: SeedTenant,
  products: SeededProduct[],
  customerIds: string[],
): Promise<void> {
  if (products.length === 0 || customerIds.length === 0) return

  const feeRate = PLAN_LIMITS[config.planCode].transactionFeeRate ?? 0.01

  for (let index = 0; index < ORDERS_PER_TENANT; index += 1) {
    const rng = makeRng(index * 7919 + config.seed)

    // Les commandes récentes sont plus denses : une distribution plate
    // donnerait une courbe de chiffre d'affaires plate, donc un graphique qui
    // ne dit rien.
    const createdAt = daysAgo(TODAY, Math.floor(DAYS_SPAN * rng() ** 1.6), index)

    const itemCount = 1 + Math.floor(rng() * 3)
    const items = Array.from({ length: itemCount }, (_, position) => {
      const product = products[(index * 3 + position * 5) % products.length]!
      const quantity = 1 + Math.floor(rng() * 3)
      return {
        tenantId,
        productId: product.id,
        // Instantané : le produit peut être renommé ou archivé ensuite, la
        // commande doit rester lisible telle qu'elle a été passée (doc/03 §4).
        productName: product.name,
        unitPriceCents: product.priceCents,
        quantity,
        lineTotalCents: product.priceCents * quantity,
      }
    })

    const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0)
    const shippingCents = subtotalCents > 100_000 ? 0 : 2_500
    const discountCents = rng() < 0.18 ? Math.round(subtotalCents * 0.1) : 0
    const totalCents = subtotalCents + shippingCents - discountCents

    const status = weightedPick(STATUS_WEIGHTS, rng())
    const method = weightedPick(METHOD_WEIGHTS, rng())

    /*
     * Rattachement client en LOI DE PUISSANCE, pas en tourniquet.
     *
     * Une répartition uniforme donne le même nombre de commandes à tout le
     * monde : un seul segment peuplé et trois tuiles à zéro. Une vraie boutique
     * a une poignée de gros clients et une longue traîne d'acheteurs à une
     * commande — c'est ce que l'exposant reproduit.
     */
    const customerId =
      customerIds[Math.min(Math.floor(customerIds.length * rng() ** 3.4), customerIds.length - 1)]!

    await prisma.order.create({
      data: {
        tenantId,
        reference: `CMD-${String(2601 + index).padStart(5, '0')}`,
        customerId,
        status,
        subtotalCents,
        shippingCents,
        taxCents: 0,
        discountCents,
        totalCents,
        platformFeeCents: Math.round(totalCents * feeRate),
        // Une commande remboursée l'a été INTÉGRALEMENT : un remboursement
        // partiel laisserait le statut inchangé (voir OrdersService.refund).
        refundedCents: status === 'refunded' ? totalCents : 0,
        currency: config.currency,
        createdAt,
        items: { create: items },
        payments: {
          create: {
            tenantId,
            method,
            status: paymentStatusFor(status),
            amountCents: totalCents,
            currency: config.currency,
            provider: method === 'card' ? 'stripe' : method,
            createdAt,
          },
        },
      },
    })
  }
}

async function report(adminEmail: string, mfaSecret: string): Promise<void> {
  const lines: string[] = []

  for (const config of TENANTS) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: config.slug } })
    const [products, customers, orders, revenue] = await Promise.all([
      prisma.product.count({ where: { tenantId: tenant.id } }),
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.order.count({ where: { tenantId: tenant.id } }),
      prisma.order.aggregate({
        where: { tenantId: tenant.id, status: { in: [...REVENUE_STATUSES] } },
        _sum: { totalCents: true },
      }),
    ])

    lines.push(
      `  ${config.slug.padEnd(18)} ${String(products).padStart(3)} produits · ` +
        `${String(customers).padStart(3)} clients · ${String(orders).padStart(3)} commandes · ` +
        `CA ${(revenue._sum.totalCents ?? 0).toLocaleString('fr-FR')} ${config.currency}`,
    )
  }

  console.warn(`
Seed terminé.

${lines.join('\n')}

  Vendeurs  : admin@alpha.test (admin), vendeur@alpha.test (employé), admin@beta.test
  Admin     : ${adminEmail}
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
