import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  TOKEN_TTL,
  type JwtPayload,
  type SessionUser,
  type TokenAudience,
  type TokenPair,
} from '@shopnest/contracts'
import type { Env } from '../../config/env.schema'
import { AppException } from '../../common/errors/app.exception'
import { RefreshTokenRepository } from './refresh-token.repository'

/**
 * doc/03 §5 — trois audiences, trois secrets, trois durées.
 *
 * Un access token de boutique ne doit JAMAIS être accepté sur une route super admin,
 * même en cas de fuite : c'est la raison d'être des secrets séparés plutôt que d'un
 * simple claim `role` qu'une erreur de guard suffirait à ignorer.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  private secretFor(audience: TokenAudience): string {
    const key = {
      customer: 'JWT_CUSTOMER_SECRET',
      tenant: 'JWT_TENANT_SECRET',
      admin: 'JWT_ADMIN_SECRET',
    } as const
    return this.config.get(key[audience], { infer: true })
  }

  async issuePair(user: SessionUser, familyId: string = randomUUID()): Promise<TokenPair> {
    const ttl = TOKEN_TTL[user.audience]

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        aud: user.audience,
        role: user.role,
        ...(user.tenantId ? { tid: user.tenantId } : {}),
      },
      { secret: this.secretFor(user.audience), expiresIn: ttl.accessSeconds },
    )

    // Le refresh token est une valeur opaque, pas un JWT : il n'a rien à transporter
    // et son unique usage est une recherche par empreinte en base.
    const refreshToken = randomBytes(48).toString('base64url')

    await this.refreshTokens.create({
      userId: user.id,
      audience: user.audience,
      tenantId: user.tenantId,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + ttl.refreshSeconds * 1000),
    })

    return { accessToken, refreshToken, expiresIn: ttl.accessSeconds }
  }

  /**
   * Lit les claims SANS vérifier la signature.
   *
   * Usage unique : le middleware de résolution du tenant, qui s'exécute avant les
   * guards et a besoin du `tid` pour ouvrir le contexte. Ce n'est pas une faille —
   * un `tid` falsifié invalide la signature, donc le JwtAuthGuard rejette la requête
   * juste après, et il vérifie en plus que le `tid` du token correspond au tenant résolu.
   * Aucune donnée n'est servie sur la seule foi de ce décodage.
   */
  decodeUnverified(token: string): JwtPayload | null {
    try {
      return this.jwt.decode<JwtPayload>(token)
    } catch {
      return null
    }
  }

  async verifyAccessToken(token: string, audience: TokenAudience): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.secretFor(audience),
      })
    } catch {
      throw new AppException('UNAUTHENTICATED', 'invalid or expired access token')
    }
  }

  /**
   * Rotation avec détection de rejeu.
   *
   * Un refresh token est à usage unique. S'il est présenté une seconde fois, c'est
   * qu'il a été volé — soit par l'attaquant, soit par le client légitime. On ne peut
   * pas distinguer les deux, donc on révoque TOUTE la famille : la session est
   * coupée des deux côtés, l'utilisateur se reconnecte, l'attaquant est éjecté.
   */
  async rotate(presentedToken: string): Promise<{ pair: TokenPair; user: SessionUser }> {
    const stored = await this.refreshTokens.findByHash(hashToken(presentedToken))

    if (!stored) throw new AppException('UNAUTHENTICATED', 'unknown refresh token')

    if (stored.revokedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId)
      throw new AppException('UNAUTHENTICATED', `refresh token reuse detected (family ${stored.familyId})`)
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new AppException('UNAUTHENTICATED', 'expired refresh token')
    }

    await this.refreshTokens.revoke(stored.id)

    const user = await this.refreshTokens.resolveUser(stored)
    const pair = await this.issuePair(user, stored.familyId)
    return { pair, user }
  }

  /** Déconnexion : révoque la famille entière, donc tous les appareils de cette session. */
  async revokeSession(presentedToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(hashToken(presentedToken))
    if (stored) await this.refreshTokens.revokeFamily(stored.familyId)
  }
}

/**
 * SHA-256 et non Argon2 : le token est déjà 48 octets aléatoires, il n'a pas
 * d'entropie faible à compenser. Un hachage lent ici ne protégerait rien et
 * ajouterait ~50 ms à chaque rafraîchissement.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
