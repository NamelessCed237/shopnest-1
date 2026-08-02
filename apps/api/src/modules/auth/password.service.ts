import { Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'

/** `Algorithm.Argon2id` est un `const enum` ambiant, inutilisable avec
 *  `isolatedModules`. La valeur numérique est stable dans l'API de la librairie. */
const ARGON2ID = 2

/**
 * doc/03 §5 — Argon2id, sans alternative.
 *
 * `@node-rs/argon2` plutôt que `argon2` : binaires précompilés, pas de node-gyp,
 * donc une installation qui fonctionne sur Windows comme en CI Linux.
 */
@Injectable()
export class PasswordService {
  // Paramètres OWASP 2024 : 19 Mo, 2 itérations, parallélisme 1.
  private readonly options = {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  }

  hash(plain: string): Promise<string> {
    return hash(plain, this.options)
  }

  async verify(digest: string, plain: string): Promise<boolean> {
    try {
      return await verify(digest, plain, this.options)
    } catch {
      // Empreinte corrompue ou format inconnu : on refuse, on ne lève pas —
      // une exception ici distinguerait ce cas d'un mot de passe faux (oracle).
      return false
    }
  }

  /**
   * Consomme le même temps CPU qu'une vérification réelle.
   *
   * Sans cela, un compte inexistant répond en 1 ms et un compte existant en 50 ms :
   * l'écart suffit à énumérer les emails valides d'une boutique.
   */
  async fakeVerify(): Promise<void> {
    await hash('timing-equalizer', this.options)
  }
}
