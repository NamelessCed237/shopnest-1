import { Injectable, Logger } from '@nestjs/common'
import { authenticator } from 'otplib'
import type {
  LoginInput,
  LoginResponse,
  RegisterCustomerInput,
  SessionUser,
  UserRole,
} from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { PrismaService, tenantScoped } from '../../database/prisma.service'
import { PasswordService } from './password.service'
import { TokenService } from './token.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Client scopé au tenant courant.
   *
   * Les lectures passent OBLIGATOIREMENT par lui, et non par `this.prisma` :
   * lui seul positionne `app.tenant_id`, sans quoi la RLS PostgreSQL ne renvoie
   * aucune ligne et toute connexion échoue en « identifiants invalides » —
   * symptôme trompeur s'il en est.
   */
  private get db() {
    return this.prisma.withTenantIsolation()
  }

  /** Connexion d'un membre de l'équipe d'un vendeur. Le tenant vient du contexte. */
  async loginTenantUser(input: LoginInput): Promise<LoginResponse> {
    // `findFirst` et non `findUnique` : le tenant n'est plus écrit ici, c'est
    // l'extension d'isolation qui l'ajoute au filtre. L'index composite
    // (tenant_id, email) sert la requête de la même façon.
    const user = await this.db.tenantUser.findFirst({
      where: { email: input.email },
    })

    if (!user) {
      // Même coût CPU que le chemin nominal : sinon l'écart de latence permet
      // d'énumérer les comptes existants d'une boutique.
      await this.passwords.fakeVerify()
      throw this.invalidCredentials()
    }

    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      throw this.invalidCredentials()
    }

    return this.respond({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      audience: 'tenant',
      tenantId: user.tenantId,
    })
  }

  /** Connexion d'un acheteur — toujours rattachée à la boutique visitée. */
  async loginCustomer(input: LoginInput): Promise<LoginResponse> {
    const customer = await this.db.customer.findFirst({
      where: { email: input.email },
    })

    if (!customer?.passwordHash) {
      await this.passwords.fakeVerify()
      throw this.invalidCredentials()
    }

    if (!(await this.passwords.verify(customer.passwordHash, input.password))) {
      throw this.invalidCredentials()
    }

    return this.respond({
      id: customer.id,
      email: customer.email,
      role: 'customer',
      audience: 'customer',
      tenantId: customer.tenantId,
    })
  }

  /** doc/03 §5 — le super admin exige un second facteur, SANS exception. */
  async loginSuperAdmin(input: LoginInput): Promise<LoginResponse> {
    const admin = await this.prisma.superAdmin.findUnique({ where: { email: input.email } })

    if (!admin) {
      await this.passwords.fakeVerify()
      throw this.invalidCredentials()
    }

    if (!(await this.passwords.verify(admin.passwordHash, input.password))) {
      throw this.invalidCredentials()
    }

    if (!admin.mfaSecret) {
      // Un compte super admin sans MFA configuré ne peut pas se connecter : on
      // préfère bloquer l'accès plutôt que dégrader la règle en avertissement.
      this.logger.error({ adminId: admin.id }, 'super admin without MFA secret')
      throw new AppException('FORBIDDEN', 'MFA not configured', {
        userMessageKey: 'errors.auth.mfaRequired',
      })
    }

    if (!input.mfaCode || !authenticator.verify({ token: input.mfaCode, secret: admin.mfaSecret })) {
      throw new AppException('UNAUTHENTICATED', 'invalid MFA code', {
        userMessageKey: 'errors.auth.invalidMfaCode',
      })
    }

    this.logger.log({ adminId: admin.id }, 'super admin signed in')
    return this.respond({
      id: admin.id,
      email: admin.email,
      role: 'super_admin',
      audience: 'admin',
    })
  }

  async registerCustomer(input: RegisterCustomerInput): Promise<LoginResponse> {
    const existing = await this.db.customer.findFirst({
      where: { email: input.email },
    })

    // Un compte peut déjà exister sans mot de passe (commande en invité) :
    // dans ce cas on le complète au lieu de refuser l'inscription.
    if (existing?.passwordHash) {
      throw new AppException('CONFLICT', 'email already registered', {
        fields: { email: 'errors.auth.emailTaken' },
      })
    }

    const passwordHash = await this.passwords.hash(input.password)

    const customer = existing
      ? await this.db.customer.update({
          where: { id: existing.id },
          data: { passwordHash, firstName: input.firstName, lastName: input.lastName },
        })
      : await this.db.customer.create({
          // `tenantId` est FORCÉ par l'extension : ne jamais l'écrire ici, ce
          // serait rouvrir la porte à une valeur venue du client. `tenantScoped`
          // ne fait que l'annoncer au typage (doc/02 §4).
          data: tenantScoped({
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
          }),
        })

    return this.respond({
      id: customer.id,
      email: customer.email,
      role: 'customer',
      audience: 'customer',
      tenantId: customer.tenantId,
    })
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const { pair, user } = await this.tokens.rotate(refreshToken)
    return { ...pair, user }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeSession(refreshToken)
  }

  private async respond(user: SessionUser): Promise<LoginResponse> {
    const pair = await this.tokens.issuePair(user)
    return { ...pair, user }
  }

  /**
   * Message identique que l'email soit inconnu ou le mot de passe faux.
   * Distinguer les deux transforme le formulaire en oracle d'énumération de comptes.
   */
  private invalidCredentials(): AppException {
    return new AppException('UNAUTHENTICATED', 'invalid credentials', {
      userMessageKey: 'errors.auth.invalidCredentials',
    })
  }
}
