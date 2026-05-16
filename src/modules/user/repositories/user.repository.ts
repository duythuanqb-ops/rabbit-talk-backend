import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    userUuid: string,
    username: string,
    email: string,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    passwordHash: string | null,
    googleId: string | null = null,
    avatarUrl: string | null = null,
    authProvider: 'local' | 'google' = 'local',
  ) {
    const sql = `
      INSERT INTO users (uuid, username, email, first_name, last_name, date_of_birth, password, google_id, avatar_url, auth_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      userUuid,
      username,
      email,
      firstName,
      lastName,
      dateOfBirth,
      passwordHash,
      googleId,
      avatarUrl,
      authProvider,
    ];
    return await this.db.execute(sql, params);
  }

  private readonly publicColumns = [
    'uuid', 'username', 'email', 'first_name', 'last_name',
    'date_of_birth', 'avatar_url', 'google_id',
    'auth_provider', 'is_email_verified', 'created_at', 'updated_at',
  ].join(', ');

  async findByGoogleId(googleId: string) {
    const sql = `SELECT ${this.publicColumns} FROM users WHERE google_id = ? LIMIT 1`;
    const users = await this.db.query(sql, [googleId]);
    return users[0] || null;
  }

  async updateGoogleId(
    userUuid: string,
    googleId: string,
    avatarUrl: string | null,
  ) {
    const sql =
      'UPDATE users SET google_id = ?, avatar_url = ?, auth_provider = ? WHERE uuid = ?';
    return await this.db.execute(sql, [
      googleId,
      avatarUrl,
      'google',
      userUuid,
    ]);
  }

  async findAll() {
    return this.db.query(`SELECT ${this.publicColumns} FROM users`);
  }

  async findByEmailOrUsername(identifier: string) {
    // Include password only for auth purposes
    const sql = 'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1';
    const users = await this.db.query(sql, [identifier, identifier]);
    return users[0] || null;
  }

  async findByUuid(uuid: string) {
    const sql = `SELECT ${this.publicColumns} FROM users WHERE uuid = ? LIMIT 1`;
    const users = await this.db.query(sql, [uuid]);
    return users[0] || null;
  }

  async setEmailVerificationToken(
    uuid: string,
    token: string,
    expiresAt: Date,
  ) {
    const sql = `
      UPDATE users
      SET email_verification_token = ?, email_verification_expires = ?
      WHERE uuid = ?
    `;
    return this.db.execute(sql, [token, expiresAt, uuid]);
  }

  async findOtpByUuid(uuid: string) {
    const sql = `
      SELECT uuid, email, email_verification_token, email_verification_expires, is_email_verified
      FROM users
      WHERE uuid = ?
      LIMIT 1
    `;
    const users = await this.db.query(sql, [uuid]);
    return users[0] || null;
  }

  async markEmailVerified(uuid: string) {
    const sql = `
      UPDATE users
      SET is_email_verified = 1,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE uuid = ?
    `;
    return this.db.execute(sql, [uuid]);
  }
}
