import { describe, expect, it } from 'vitest'
import { TENANT_SCOPED_MODELS } from '../../src/database/prisma.service'

/**
 * doc/08 §3 — LA SUITE LA PLUS IMPORTANTE DU PROJET.
 * Elle bloque tout déploiement en cas d'échec, sans dérogation possible.
 *
 * Les cas d'intégration ci-dessous nécessitent un PostgreSQL de test
 * (Testcontainers) — ils sont marqués `todo` tant que l'infra de test n'est pas
 * branchée, mais leur intitulé fixe déjà le contrat attendu.
 */

describe('isolation multi-tenant — garde-fou statique', () => {
  it('tout modèle ayant une colonne tenant_id figure dans TENANT_SCOPED_MODELS', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const schema = await fs.readFile(
      path.resolve(__dirname, '../../prisma/schema.prisma'),
      'utf8',
    )

    // Un modèle est scopé s'il déclare littéralement `tenantId ... @map("tenant_id")`.
    // On ne peut pas se contenter de chercher la sous-chaîne « tenant_id » : AuditLog
    // porte `target_tenant_id`, qui est une référence, pas une colonne d'isolation.
    const SCOPED_FIELD = /\btenantId\s+String\s+@map\("tenant_id"\)/
    const scopedInSchema = [...schema.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)]
      .filter(([, , body]) => SCOPED_FIELD.test(body ?? ''))
      .map(([, name]) => name as string)

    const missing = scopedInSchema.filter((m) => !TENANT_SCOPED_MODELS.has(m))

    expect(
      missing,
      `Modèles scopés absents de TENANT_SCOPED_MODELS — leurs requêtes NE SONT PAS filtrées : ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('les modèles globaux ne sont pas scopés par erreur', () => {
    for (const global of ['Tenant', 'Plan', 'SuperAdmin', 'AuditLog', 'WebhookEvent']) {
      expect(TENANT_SCOPED_MODELS.has(global)).toBe(false)
    }
  })
})

describe('isolation multi-tenant — intégration', () => {
  it.todo("un tenant ne lit jamais les produits d'un autre")
  it.todo("un accès direct par id à une ressource d'un autre tenant renvoie 404, pas 403")
  it.todo('un tenantId falsifié dans le corps de requête est ignoré')
  it.todo('une requête sans contexte tenant est refusée, jamais servie sans filtre')
  it.todo('la RLS PostgreSQL bloque même une requête SQL brute')
  it.todo('un job BullMQ restaure le TenantContext depuis ses données')
})
