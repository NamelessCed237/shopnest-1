import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { imageExtension, type RequestUploadInput, type UploadTicket } from '@shopnest/contracts'
import { TenantContext } from '../../tenancy/tenant-context'
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver'

/**
 * Chemins autorisés dans le bucket.
 *
 * `<tenantId>/<usage>/<uuid>.<extension>` — trois segments, tous contraints.
 *
 * Le préfixe par tenant n'est pas décoratif : il rend l'appartenance d'un
 * fichier lisible sur le chemin lui-même, ce qui permet de purger une boutique
 * fermée par un seul appel récursif, et de poser plus tard une politique de
 * bucket par préfixe sans rien migrer.
 */
const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z-]{1,32}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_DRIVER) private readonly storage: StorageDriver) {}

  createTicket(input: RequestUploadInput): Promise<UploadTicket> {
    const tenantId = TenantContext.getTenantIdOrThrow()

    /*
     * Le nom du fichier envoyé par le client n'est JAMAIS repris.
     *
     * Il vient d'un poste que rien ne contrôle : il peut contenir `../`, un
     * octet nul, un caractère Unicode qui inverse le sens de lecture, ou une
     * double extension `photo.png.html` que le serveur de fichiers finirait
     * par servir comme du HTML. Un UUID tiré au sort ne pose aucune de ces
     * questions — et évite au passage qu'un second envoi du même fichier
     * écrase le premier, qui est peut-être déjà référencé par un produit.
     */
    const key = `${tenantId}/${input.purpose}/${randomUUID()}.${imageExtension(input.contentType)}`

    return this.storage.createUploadTicket({
      key,
      contentType: input.contentType,
      byteSize: input.byteSize,
    })
  }
}
