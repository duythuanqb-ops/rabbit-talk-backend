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
        hashedPassword
      );

      return {
        id: (result as any).insertId,
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

  async findAll() {
    return this.userRepository.findAll();
  }

  async findByEmailOrUsername(identifier: string) {
    return this.userRepository.findByEmailOrUsername(identifier);
  }
}
