import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { UploadModule } from '../upload/upload.module';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import config from '../../config';

@Module({
  imports: [
    UserModule,
    MailModule,
    UploadModule,
    PassportModule,
    JwtModule.register({
      secret: config.jwt.secret,
      signOptions: {
        expiresIn: config.jwt.accessExpiration as never,
      },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, RefreshTokenRepository],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
