import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(userUuid: string, username: string, email: string, firstName: string, lastName: string, dateOfBirth: string, passwordHash: string) {
    const sql = `
      INSERT INTO users (uuid, username, email, first_name, last_name, date_of_birth, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [userUuid, username, email, firstName, lastName, dateOfBirth, passwordHash];
    return await this.db.execute(sql, params);
  }

  async findAll() {
    return this.db.query('SELECT * FROM users');
  }

  async findByEmailOrUsername(identifier: string) {
    const sql = 'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1';
    const users = await this.db.query(sql, [identifier, identifier]);
    return users[0] || null;
  }
}
