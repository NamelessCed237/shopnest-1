import { createHmac, timingSafeEqual } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Logger } from '@nestjs/common'
import type { UploadTicket } from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { TICKET_TTL_SECONDS, type StorageDriver, type UploadTicketParams } from './storage.driver'

/**
 * Pilote de DÉVELOPPEMENT : disque local, servi par l'API elle-même.
 *
 * Il existe pour une raison précise : un dépôt fraîchement cloné doit pouvoir
 * téléverser une image sans compte Supabase, sans bucket à créer et sans clé
 * de service à obtenir. Sans lui, la moitié du formulaire produit resterait
 * décorative jusqu'à ce que l'environnement soit complet — et personne ne
 * s'apercevrait qu'elle est cassée.
 *
 * Il reproduit le MÊME contrat que le pilote Supabase : ticket signé, envoi
 * direct par le navigateur, URL publique. Ce qui est vérifié en local est donc
 * la vraie chaîne, pas un raccourci qui masquerait le comportement réel.
 *
 * Il est refusé en staging et en production (`env.schema`) : le disque d'un
 * conteneur disparaît au déploiement suivant, et les images avec lui.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local'
  private readonly logger = new Logger(LocalStorageDriver.name)
  private readonly root: string

  constructor(
    rootDir: string,
    private readonly publicBaseUrl: string,
    /**
     * Secret de signature. On réutilise un secret JWT existant plutôt que d'en
     * introduire un de plus : c'est un pilote de développement, et une
     * variable d'environnement supplémentaire à documenter pour lui seul
     * serait un coût permanent pour un usage temporaire.
     */
    private readonly signingSecret: string,
  ) {
    this.root = resolve(rootDir)
  }

  createUploadTicket({ key, contentType, byteSize }: UploadTicketParams): Promise<UploadTicket> {
    const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS
    const signature = this.sign(key, contentType, byteSize, expiresAt)

    const query = `ct=${encodeURIComponent(contentType)}&sz=${byteSize}&exp=${expiresAt}&sig=${signature}`

    return Promise.resolve({
      uploadUrl: `${this.publicBaseUrl}/uploads/local/${key}?${query}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      publicUrl: `${this.publicBaseUrl}/uploads/local/${key}`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    })
  }

  /**
   * Vérifie un ticket présenté à l'écriture.
   *
   * La signature couvre le TYPE et la TAILLE en plus du chemin : sans cela, un
   * ticket obtenu pour une vignette de 20 Ko autoriserait l'envoi d'un fichier
   * de 500 Mo au même emplacement.
   */
  verifyTicket(key: string, query: Record<string, unknown>): { contentType: string; byteSize: number } {
    const contentType = String(query.ct ?? '')
    const byteSize = Number(query.sz)
    const expiresAt = Number(query.exp)
    const signature = String(query.sig ?? '')

    if (!Number.isFinite(byteSize) || !Number.isFinite(expiresAt)) {
      throw new AppException('VALIDATION_FAILED', 'malformed upload ticket')
    }
    if (expiresAt * 1000 < Date.now()) {
      throw new AppException('VALIDATION_FAILED', 'upload ticket expired', {
        userMessageKey: 'errors.upload.expired',
      })
    }

    const expected = this.sign(key, contentType, byteSize, expiresAt)
    // Comparaison à temps constant : une comparaison `===` laisse fuir, par le
    // temps de réponse, la longueur du préfixe correct — de quoi reconstruire
    // une signature octet par octet.
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppException('FORBIDDEN', 'invalid upload signature')
    }

    return { contentType, byteSize }
  }

  /**
   * Écrit le flux entrant, en s'arrêtant NET au-delà de la taille annoncée.
   *
   * On ne fait pas confiance à `Content-Length` : il est déclaratif, et un
   * client peut l'annoncer à 1 Ko puis envoyer un gigaoctet. Le compteur porte
   * donc sur les octets réellement reçus, et le fichier partiel est effacé —
   * sans quoi le disque garderait des morceaux de fichiers rejetés.
   */
  async write(key: string, stream: NodeJS.ReadableStream, maxBytes: number): Promise<void> {
    const target = join(this.root, key)
    await mkdir(dirname(target), { recursive: true })

    const file = createWriteStream(target)
    let received = 0

    try {
      await new Promise<void>((resolvePromise, reject) => {
        stream.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (received > maxBytes) {
            reject(
              new AppException('VALIDATION_FAILED', `upload exceeds ${maxBytes} bytes`, {
                userMessageKey: 'errors.upload.tooLarge',
              }),
            )
          }
        })
        stream.on('error', reject)
        file.on('error', reject)
        file.on('finish', resolvePromise)
        stream.pipe(file)
      })
    } catch (error) {
      file.destroy()
      await unlink(target).catch(() => {
        // Le fichier peut n'avoir jamais été créé : l'échec du nettoyage ne
        // doit pas masquer l'erreur d'origine, seule utile à l'appelant.
      })
      throw error
    }

    this.logger.debug(`écrit ${received} octets → ${key}`)
  }

  /**
   * Ouvre un fichier en lecture. `undefined` s'il n'existe pas.
   *
   * On renvoie un FLUX et non un chemin, pour deux raisons. La première tient
   * au fait que `res.sendFile` d'Express refuse tout chemin dont un segment
   * commence par un point : le dossier par défaut s'appelant `.storage`, il
   * répondait 404 sur un fichier pourtant présent. La seconde est que le
   * chemin sur disque n'a aucune raison de sortir du pilote — c'est
   * exactement le détail que l'interface `StorageDriver` existe pour cacher.
   */
  async read(key: string): Promise<{ stream: NodeJS.ReadableStream; size: number } | undefined> {
    const target = join(this.root, key)
    try {
      const info = await stat(target)
      if (!info.isFile()) return undefined
      return { stream: createReadStream(target), size: info.size }
    } catch {
      return undefined
    }
  }

  private sign(key: string, contentType: string, byteSize: number, expiresAt: number): string {
    return createHmac('sha256', this.signingSecret)
      // Séparateur qui ne peut apparaître dans aucun des champs : concaténer
      // sans lui rendrait ('ab', 'c') et ('a', 'bc') identiques à la signature.
      .update([key, contentType, byteSize, expiresAt].join('\n'))
      .digest('hex')
  }
}
