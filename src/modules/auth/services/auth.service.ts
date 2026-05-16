import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/services/user.service';
import { verifyPassword } from '../../user/utils/password.utils';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import config from '../../../config';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
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
    const payload = { username: user.username, sub: user.uuid, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: config.jwt.accessExpiration as any,
    });
    const refreshToken = await this.generateRefreshToken(user.uuid, deviceInfo, ipAddress);

    return {
      accessToken,
      refreshToken,
      user: {
        uuid: user.uuid,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };
  }

  async generateRefreshToken(userUuid: string, deviceInfo?: string, ipAddress?: string): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    const days = parseInt(config.jwt.refreshExpiration);
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.refreshTokenRepository.upsert(userUuid, token, expiresAt, deviceInfo || 'Unknown', ipAddress || 'Unknown');
    return token;
  }

  async refreshAccessToken(refreshToken: string) {
    const storedToken = await this.refreshTokenRepository.findValidToken(refreshToken);

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.updateLastActive(refreshToken);

    const payload = { 
      username: storedToken.username, 
      sub: storedToken.user_uuid, 
      email: storedToken.email 
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
      },
    };
  }

  async revokeRefreshToken(token: string) {
    await this.refreshTokenRepository.revokeToken(token);
  }
}
