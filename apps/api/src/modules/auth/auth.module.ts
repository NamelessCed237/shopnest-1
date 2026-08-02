import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { RefreshTokenRepository } from './refresh-token.repository'
import { TokenService } from './token.service'

/**
 * Global : `TokenService` est requis par le JwtAuthGuard, lui-même enregistré
 * globalement dans AppModule.
 *
 * JwtModule est enregistré SANS secret par défaut : chaque signature passe son
 * secret explicitement selon l'audience (doc/03 §5). Un secret par défaut ici
 * serait exactement le point de confusion qu'on veut éviter.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordService, RefreshTokenRepository],
  exports: [TokenService, PasswordService],
})
export class AuthModule {}
