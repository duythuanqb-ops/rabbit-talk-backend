import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateUserDto } from '../dto/user.dto';
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
}
