import { describe, expect, it } from 'vitest'
import { PasswordService } from './password.service'

const passwords = new PasswordService()

describe('PasswordService', () => {
  it('produit une empreinte Argon2id vérifiable', async () => {
    const digest = await passwords.hash('MotDePasseSolide1')
    expect(digest.startsWith('$argon2id$')).toBe(true)
    expect(await passwords.verify(digest, 'MotDePasseSolide1')).toBe(true)
  })

  it('rejette un mot de passe incorrect', async () => {
    const digest = await passwords.hash('MotDePasseSolide1')
    expect(await passwords.verify(digest, 'MotDePasseSolide2')).toBe(false)
  })

  it('produit une empreinte différente à chaque appel (sel aléatoire)', async () => {
    const [a, b] = await Promise.all([
      passwords.hash('MotDePasseSolide1'),
      passwords.hash('MotDePasseSolide1'),
    ])
    expect(a).not.toBe(b)
  })

  it('renvoie false sur une empreinte corrompue au lieu de lever', async () => {
    // Lever ici distinguerait « compte cassé » de « mot de passe faux » : un oracle.
    expect(await passwords.verify('pas-une-empreinte', 'peu importe')).toBe(false)
  })

  it('fakeVerify coûte le même ordre de grandeur qu’une vérification réelle', async () => {
    const digest = await passwords.hash('MotDePasseSolide1')

    const t0 = performance.now()
    await passwords.verify(digest, 'MotDePasseSolide1')
    const real = performance.now() - t0

    const t1 = performance.now()
    await passwords.fakeVerify()
    const fake = performance.now() - t1

    // Tolérance large : on protège contre un écart d'un ordre de grandeur
    // (1 ms vs 50 ms), pas contre quelques millisecondes de bruit.
    expect(fake).toBeGreaterThan(real / 5)
  }, 20_000)
})
