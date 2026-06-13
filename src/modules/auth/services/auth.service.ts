import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/services/user.service';
import { verifyPassword } from '../../user/utils/password.utils';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import config from '../../../config';
import { randomBytes } from 'crypto';

export interface AuthUser {
  uuid: string;
  username: string;
  email: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  google_id?: string;
  avatar_url?: string;
  auth_provider?: string;
  password?: string;
  [key: string]: unknown;
}

interface TokenPayload {
  username: string;
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async validateUser(
    identifier: string,
    pass: string,
  ): Promise<Omit<AuthUser, 'password'>> {
    const user = await this.userService.findByEmailOrUsername(identifier);

    if (!user) {
      throw new UnauthorizedException('Email or username does not exist');
    }

    if (!user.password || !verifyPassword(pass, user.password)) {
      throw new UnauthorizedException('Incorrect password');
    }

    const { password: _password, ...result } = user;
    return result;
  }

  async login(user: AuthUser, deviceInfo?: string, ipAddress?: string) {
    const payload: TokenPayload = {
      username: user.username,
      sub: user.uuid,
      email: user.email,
      role: (user.role as string) ?? 'student',
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: config.jwt.accessExpiration as unknown as number,
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
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        role: (user.role as string) ?? 'student',
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

    const payload: TokenPayload = {
      username: storedToken.username as string,
      sub: storedToken.user_uuid,
      email: storedToken.email as string,
      role: (storedToken.role as string) ?? 'student',
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: config.jwt.accessExpiration as unknown as number,
      }),
      user: {
        uuid: storedToken.user_uuid,
        username: storedToken.username as string,
        email: storedToken.email as string,
        first_name: storedToken.first_name as string,
        last_name: storedToken.last_name as string,
        role: (storedToken.role as string) ?? 'student',
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

      const payload = (await response.json()) as {
        sub: string;
        email: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

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
          user.avatar_url = picture || null;
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

      return this.login(user as unknown as AuthUser, deviceInfo, ipAddress);
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
