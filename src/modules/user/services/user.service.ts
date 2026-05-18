import { BadRequestException, NotFoundException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateUserDto, UpdateProfileDto, RegisterTeacherDto } from '../dto/user.dto';
import { UserRepository } from '../repositories/user.repository';
import { hashPassword, parseDuplicateKeyError } from '../utils/password.utils';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(data: CreateUserDto) {
    const userUuid = randomUUID();
    const hashedPassword = hashPassword(data.password);

    try {
      const result = await this.userRepository.create(
        userUuid,
        data.username,
        data.email,
        data.first_name,
        data.last_name,
        data.date_of_birth,
        hashedPassword,
        null,
        null,
        'local',
      );

      return {
        id: result.insertId,
        uuid: userUuid,
        ...data,
        password: undefined,
      };
    } catch (error: any) {
      const duplicateMessage = parseDuplicateKeyError(error);
      if (duplicateMessage) {
        throw new BadRequestException(duplicateMessage);
      }
      throw error;
    }
  }

  async createGoogleUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    googleId: string;
    avatarUrl?: string;
  }) {
    const userUuid = randomUUID();
    // generate a random username based on email
    const username =
      data.email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
    // set a default date of birth for google users, e.g. 2000-01-01
    const dateOfBirth = '2000-01-01';

    try {
      const result = await this.userRepository.create(
        userUuid,
        username,
        data.email,
        data.firstName,
        data.lastName,
        dateOfBirth,
        null, // No password for Google users
        data.googleId,
        data.avatarUrl || null,
        'google',
      );

      return {
        id: result.insertId,
        uuid: userUuid,
        username,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        date_of_birth: dateOfBirth,
        avatar_url: data.avatarUrl,
        auth_provider: 'google',
      };
    } catch (error: any) {
      const duplicateMessage = parseDuplicateKeyError(error);
      if (duplicateMessage) {
        throw new BadRequestException(duplicateMessage);
      }
      throw error;
    }
  }

  async findByGoogleId(googleId: string) {
    return this.userRepository.findByGoogleId(googleId);
  }

  async updateGoogleId(
    userUuid: string,
    googleId: string,
    avatarUrl: string | null,
  ) {
    return this.userRepository.updateGoogleId(userUuid, googleId, avatarUrl);
  }

  async findAll() {
    return this.userRepository.findAll();
  }

  async findByEmailOrUsername(identifier: string) {
    return this.userRepository.findByEmailOrUsername(identifier);
  }

  async findByUuid(uuid: string) {
    return this.userRepository.findByUuid(uuid);
  }

  /**
   * Generates a 6-digit OTP, stores it with a 5-minute expiry, and returns the code.
   */
  async initiateEmailVerification(uuid: string): Promise<string> {
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await this.userRepository.setEmailVerificationToken(uuid, otp, expiresAt);
    return otp;
  }

  /**
   * Verifies the OTP submitted by an authenticated user.
   */
  async verifyEmailOtp(
    uuid: string,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOtpByUuid(uuid);

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (user.is_email_verified) {
      return { success: false, message: 'Email is already verified.' };
    }

    if (!user.email_verification_token) {
      return { success: false, message: 'No verification code found. Please request a new one.' };
    }

    const expires = new Date(user.email_verification_expires);
    if (expires < new Date()) {
      return { success: false, message: 'Verification code has expired. Please request a new one.' };
    }

    if (user.email_verification_token !== code.trim()) {
      return { success: false, message: 'Invalid verification code.' };
    }

    await this.userRepository.markEmailVerified(uuid);
    return { success: true, message: 'Email verified successfully.' };
  }

  async updateProfile(uuid: string, dto: UpdateProfileDto) {
    await this.userRepository.updateProfile(uuid, {
      first_name: dto.first_name,
      last_name: dto.last_name,
      bio: dto.bio,
    });
    return this.userRepository.findByUuid(uuid);
  }

  async updateAvatar(uuid: string, avatarUrl: string | null) {
    await this.userRepository.updateAvatar(uuid, avatarUrl);
    return this.userRepository.findByUuid(uuid);
  }

  async registerTeacher(uuid: string, dto: RegisterTeacherDto) {
    const user = await this.userRepository.findByUuid(uuid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.is_email_verified) {
      throw new BadRequestException('Email must be verified before registering as a teacher');
    }
    if (user.role === 'teacher') {
      throw new BadRequestException('You are already registered as a teacher');
    }

    await this.userRepository.registerTeacher(uuid, dto);
    return { message: 'Successfully registered as a teacher' };
  }
}

