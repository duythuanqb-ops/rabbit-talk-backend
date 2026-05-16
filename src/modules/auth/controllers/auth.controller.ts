import {
  Controller,
  Post,
  UseGuards,
  Request,
  Res,
  Get,
  UnauthorizedException,
  Headers,
  Ip,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LoginDto } from '../dto/auth.dto';
import config from '../../../config';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      req.user,
      userAgent,
      ip,
    );

    this.setTokenCookies(res, accessToken, refreshToken);

    return {
      message: 'Login successful',
      user,
    };
  }

  @Post('google')
  async googleLogin(
    @Body('token') token: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
  ) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.loginWithGoogle(token, userAgent, ip);

    this.setTokenCookies(res, accessToken, refreshToken);

    return {
      message: 'Google login successful',
      user,
    };
  }

  @Post('refresh')
  async refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const { accessToken, user } =
      await this.authService.refreshAccessToken(refreshToken);

    const isProduction = config.nodeEnv === 'production';
    const isLocalhost =
      config.frontendUrl.includes('localhost') ||
      config.frontendUrl.includes('127.0.0.1');
    const secure = isProduction && !isLocalhost;

    // We only refresh the access token cookie
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    return {
      message: 'Token refreshed',
      user,
    };
  }

  @Post('logout')
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refresh_token;
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = config.nodeEnv === 'production';
    const isLocalhost =
      config.frontendUrl.includes('localhost') ||
      config.frontendUrl.includes('127.0.0.1');

    // Secure is true only if in production AND not on localhost
    const secure = isProduction && !isLocalhost;

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
