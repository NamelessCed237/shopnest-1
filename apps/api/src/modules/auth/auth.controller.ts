import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import {
  LoginSchema,
  RefreshSchema,
  RegisterCustomerSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterCustomerInput,
} from '@shopnest/contracts'
import { Public } from '../../common/decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthService } from './auth.service'

/**
 * doc/03 §5 — les limites de débit ci-dessous ne sont pas décoratives :
 * sans elles, un formulaire de connexion est une surface de bourrage
 * d'identifiants ouverte sur toutes les boutiques à la fois.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  loginTenantUser(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginInput) {
    return this.auth.loginTenantUser(dto)
  }

  @Post('customer/login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  loginCustomer(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginInput) {
    return this.auth.loginCustomer(dto)
  }

  @Post('customer/register')
  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  register(@Body(new ZodValidationPipe(RegisterCustomerSchema)) dto: RegisterCustomerInput) {
    return this.auth.registerCustomer(dto)
  }

  @Post('admin/login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  loginSuperAdmin(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginInput) {
    return this.auth.loginSuperAdmin(dto)
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshInput) {
    return this.auth.refresh(dto.refreshToken)
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshInput): Promise<void> {
    await this.auth.logout(dto.refreshToken)
  }
}
