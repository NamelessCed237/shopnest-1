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
import { PrismaService } from '../../database/prisma.service'
import { TenantContext } from '../../tenancy/tenant-context'
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

  /** Connexion d'un membre de l'équipe d'un vendeur. Le tenant vient du contexte. */
  async loginTenantUser(input: LoginInput): Promise<LoginResponse> {
    const tenantId = TenantContext.getTenantIdOrThrow()

    const user = await this.prisma.tenantUser.findUnique({
      where: { tenantId_email: { tenantId, email: input.email } },
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
    const tenantId = TenantContext.getTenantIdOrThrow()

    const customer = await this.prisma.customer.findUnique({
      where: { tenantId_email: { tenantId, email: input.email } },
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
    const tenantId = TenantContext.getTenantIdOrThrow()

    const existing = await this.prisma.customer.findUnique({
      where: { tenantId_email: { tenantId, email: input.email } },
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
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: { passwordHash, firstName: input.firstName, lastName: input.lastName },
        })
      : await this.prisma.customer.create({
          data: {
            tenantId,
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
          },
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
