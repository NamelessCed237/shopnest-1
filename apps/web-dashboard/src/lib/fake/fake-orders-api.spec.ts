import { describe, expect, it } from 'vitest'
import { fakeOrderEndpoints } from './fake-orders-api'
import { fakeOrders } from './orders.fixtures'

/**
 * doc/08 §4 — les garde-fous de mutation sont testés, pas seulement écrits.
 *
 * L'idempotence et le plafond de remboursement sont exactement les règles dont
 * l'absence coûte de l'argent réel. Elles sont vérifiées ici sur la version
 * factice, et devront l'être à l'identique sur le vrai backend.
 */

const orderWithStatus = (status: string) => {
  const order = fakeOrders.find((item) => item.status === status)
  if (!order) throw new Error(`aucune fixture au statut ${status}`)
  return order
}

describe('updateStatus', () => {
  it('rejoue la MÊME clé sans produire un second changement', async () => {
    const order = orderWithStatus('preparing')
    const key = crypto.randomUUID()

    const first = await fakeOrderEndpoints.updateStatus(order.id, {
      status: 'shipped',
      idempotencyKey: key,
    })
    const replay = await fakeOrderEndpoints.updateStatus(order.id, {
      status: 'shipped',
      idempotencyKey: key,
    })

    expect(first.status).toBe('shipped')
    expect(replay).toEqual(first)
    expect((await fakeOrderEndpoints.detail(order.id)).status).toBe('shipped')
  })

  it('refuse une transition absente de ORDER_TRANSITIONS', async () => {
    const order = orderWithStatus('delivered')

    await expect(
      fakeOrderEndpoints.updateStatus(order.id, {
        status: 'preparing',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('renvoie une COPIE, pas l’objet du magasin', async () => {
    // Sinon React Query ne détecte aucun changement de référence et l'écran
    // affiche l'ancien statut alors que la mutation a eu lieu.
    const order = orderWithStatus('paid')
    const result = await fakeOrderEndpoints.detail(order.id)
    expect(result).not.toBe(order)
    expect(result.items[0]).not.toBe(order.items[0])
  })
})

describe('refund', () => {
  it('plafonne au reste remboursable', async () => {
    const order = orderWithStatus('delivered')

    await expect(
      fakeOrderEndpoints.refund(order.id, {
        amountCents: order.total.amountCents * 2,
        reason: 'test',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('cumule les remboursements partiels et bascule au statut remboursé une fois soldé', async () => {
    const order = orderWithStatus('delivered')
    const half = Math.floor(order.total.amountCents / 2)

    const partial = await fakeOrderEndpoints.refund(order.id, {
      amountCents: half,
      reason: 'partiel',
      idempotencyKey: crypto.randomUUID(),
    })
    // Un remboursement partiel ne change PAS le statut : la commande a bien
    // été livrée, réécrire son statut falsifierait l'historique.
    expect(partial.status).toBe('delivered')
    expect(partial.refundedAmount?.amountCents).toBe(half)

    const full = await fakeOrderEndpoints.refund(order.id, {
      amountCents: order.total.amountCents - half,
      reason: 'solde',
      idempotencyKey: crypto.randomUUID(),
    })
    expect(full.status).toBe('refunded')
    expect(full.payment?.status).toBe('refunded')
    expect(full.refundedAmount?.amountCents).toBe(order.total.amountCents)
  })

  it('refuse un remboursement sur une commande non encaissée', async () => {
    const order = orderWithStatus('cancelled')

    await expect(
      fakeOrderEndpoints.refund(order.id, {
        amountCents: 100,
        reason: 'test',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
