import {
  Controller,
  Post,
  Patch,
  UseGuards,
  Request,
  Res,
  Get,
  Header,
  BadRequestException,
  UnauthorizedException,
  Headers,
  Ip,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserService } from '../../user/services/user.service';
import { MailService } from '../../mail/mail.service';
import { UploadService } from '../../upload/upload.service';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LoginDto } from '../dto/auth.dto';
import { UpdateProfileDto, RegisterTeacherDto } from '../../user/dto/user.dto';
import config from '../../../config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private mailService: MailService,
    private uploadService: UploadService,
  ) {}

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
  @Header('Cache-Control', 'no-store')
  getProfile(@Request() req) {
    return this.userService.findByUuid(req.user.uuid);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.uuid, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const avatarUrl = await this.uploadService.uploadAvatar(file);
    await this.userService.updateAvatar(req.user.uuid, avatarUrl);
    return { message: 'Avatar updated successfully', avatar_url: avatarUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('avatar/remove')
  async removeAvatar(@Request() req) {
    await this.userService.updateAvatar(req.user.uuid, null);
    return { message: 'Avatar removed successfully', avatar_url: null };
  }

  /**
   * POST /auth/send-verification-email
   * Generates a 6-digit OTP and sends it to the logged-in user's email.
   */
  @UseGuards(JwtAuthGuard)
  @Post('send-verification-email')
  async sendVerificationEmail(@Request() req) {
    const user = await this.userService.findByUuid(req.user.uuid);
    if (!user) throw new UnauthorizedException('User not found.');
    if (user.is_email_verified) {
      throw new BadRequestException('Email is already verified.');
    }

    const otp = await this.userService.initiateEmailVerification(req.user.uuid);
    await this.mailService.sendEmailVerification(user.email, otp);

    return { message: 'Verification code sent. Please check your inbox.' };
  }

  /**
   * POST /auth/verify-email-otp
   * Authenticated user submits the 6-digit OTP to verify their email.
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify-email-otp')
  async verifyEmailOtp(@Request() req, @Body('code') code: string) {
    if (!code || code.trim().length !== 6) {
      throw new BadRequestException('Please enter a valid 6-digit code.');
    }

    const result = await this.userService.verifyEmailOtp(req.user.uuid, code);

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return { message: result.message };
  }

  /**
   * POST /auth/teacher/register
   * Authenticated user registers as a teacher.
   */
  @UseGuards(JwtAuthGuard)
  @Post('teacher/register')
  async registerTeacher(@Request() req, @Body() dto: RegisterTeacherDto) {
    return this.userService.registerTeacher(req.user.uuid, dto);
  }
}

