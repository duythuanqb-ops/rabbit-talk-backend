import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateUserDto } from '../dto/user.dto';
import { DatabaseService } from '../../../database/database.service';
import { hashPassword, parseDuplicateKeyError } from '../utils/user.utils';

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateUserDto) {
    const userUuid = randomUUID();
    const hashedPassword = hashPassword(data.password);
    const sql = `
      INSERT INTO users (uuid, username, email, first_name, last_name, date_of_birth, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      userUuid,
      data.username,
      data.email,
      data.first_name,
      data.last_name,
      data.date_of_birth,
      hashedPassword,
    ];

    try {
      const result = (await this.db.execute(sql, params)) as {
        insertId: number;
      };
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

  async findAll() {
    return this.db.query('SELECT * FROM users');
  }
}
