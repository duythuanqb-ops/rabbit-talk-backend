import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/services/user.service';
import { verifyPassword } from '../../user/utils/password.utils';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import config from '../../../config';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmailOrUsername(identifier);

    if (!user) {
      throw new UnauthorizedException('Email or username does not exist');
    }

    if (!verifyPassword(pass, user.password)) {
      throw new UnauthorizedException('Incorrect password');
    }

    const { password, ...result } = user;
    return result;
  }

  async login(user: any, deviceInfo?: string, ipAddress?: string) {
    const payload = {
      username: user.username,
      sub: user.uuid,
      email: user.email,
      role: user.role ?? 'student',
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: config.jwt.accessExpiration as any,
    });
    const refreshToken = await this.generateRefreshToken(
      user.uuid,
      deviceInfo,
      ipAddress,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        uuid: user.uuid,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role ?? 'student',
      },
    };
  }

  async generateRefreshToken(
    userUuid: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    const days = parseInt(config.jwt.refreshExpiration);
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.refreshTokenRepository.upsert(
      userUuid,
      token,
      expiresAt,
      deviceInfo || 'Unknown',
      ipAddress || 'Unknown',
    );
    return token;
  }

  async refreshAccessToken(refreshToken: string) {
    const storedToken =
      await this.refreshTokenRepository.findValidToken(refreshToken);

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.updateLastActive(refreshToken);

    const payload = {
      username: storedToken.username,
      sub: storedToken.user_uuid,
      email: storedToken.email,
      role: storedToken.role ?? 'student',
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: config.jwt.accessExpiration as any,
      }),
      user: {
        uuid: storedToken.user_uuid,
        username: storedToken.username,
        email: storedToken.email,
        first_name: storedToken.first_name,
        last_name: storedToken.last_name,
        role: storedToken.role ?? 'student',
      },
    };
  }

  async revokeRefreshToken(token: string) {
    await this.refreshTokenRepository.revokeToken(token);
  }

  async loginWithGoogle(
    token: string,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        this.logger.error(
          `[GoogleAuth] userinfo endpoint failed: ${response.status} ${errBody}`,
        );
        throw new UnauthorizedException('Invalid Google access token');
      }

      const payload = await response.json();

      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const {
        sub: googleId,
        email,
        given_name,
        family_name,
        picture,
      } = payload;

      let user = await this.userService.findByGoogleId(googleId);

      if (!user) {
        user = await this.userService.findByEmailOrUsername(email);

        if (user) {
          await this.userService.updateGoogleId(
            user.uuid,
            googleId,
            picture || null,
          );
          user.google_id = googleId;
          user.avatar_url = picture;
          user.auth_provider = 'google';
        } else {
          user = await this.userService.createGoogleUser({
            email,
            firstName: given_name || '',
            lastName: family_name || '',
            googleId,
            avatarUrl: picture,
          });
        }
      }

      return this.login(user, deviceInfo, ipAddress);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        `[GoogleAuth] Unexpected error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new UnauthorizedException(
        `Google authentication failed: ${(error as Error)?.message || 'Unknown error'}`,
      );
    }
  }
}
