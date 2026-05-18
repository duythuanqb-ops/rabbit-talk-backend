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
    'date_of_birth', 'avatar_url', 'google_id', 'bio',
    'auth_provider', 'is_email_verified', 'role', 'created_at', 'updated_at',
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

  async updateProfile(
    uuid: string,
    fields: { first_name?: string; last_name?: string; bio?: string },
  ) {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (fields.first_name !== undefined) {
      setClauses.push('first_name = ?');
      params.push(fields.first_name);
    }
    if (fields.last_name !== undefined) {
      setClauses.push('last_name = ?');
      params.push(fields.last_name);
    }
    if (fields.bio !== undefined) {
      setClauses.push('bio = ?');
      params.push(fields.bio);
    }

    if (setClauses.length === 0) return;

    const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE uuid = ?`;
    params.push(uuid);
    return this.db.execute(sql, params);
  }

  async updateAvatar(uuid: string, avatarUrl: string | null) {
    const sql = 'UPDATE users SET avatar_url = ? WHERE uuid = ?';
    return this.db.execute(sql, [avatarUrl, uuid]);
  }

  async registerTeacher(uuid: string, dto: any) {
    const sql = `
      INSERT INTO teacher_profiles (user_uuid, headline, experience_years, video_intro_url, certificates, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
      ON DUPLICATE KEY UPDATE 
        headline = VALUES(headline),
        experience_years = VALUES(experience_years),
        video_intro_url = VALUES(video_intro_url),
        certificates = VALUES(certificates),
        status = 'pending'
    `;
    return this.db.execute(sql, [
      uuid,
      dto.headline,
      dto.experience_years,
      dto.video_intro_url || null,
      dto.certificates || null
    ]);
  }

  async getTeacherRequests() {
    const sql = `
      SELECT 
        tp.id, tp.headline, tp.experience_years, tp.video_intro_url, tp.certificates, tp.status, tp.created_at,
        u.uuid, u.email, u.first_name, u.last_name, u.avatar_url
      FROM teacher_profiles tp
      JOIN users u ON tp.user_uuid = u.uuid
      ORDER BY tp.created_at DESC
    `;
    return this.db.query(sql);
  }

  async updateTeacherRequestStatus(uuid: string, status: 'approved' | 'rejected') {
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();
      
      await conn.execute('UPDATE teacher_profiles SET status = ? WHERE user_uuid = ?', [status, uuid]);
      
      if (status === 'approved') {
        await conn.execute('UPDATE users SET role = "teacher" WHERE uuid = ?', [uuid]);
      }
      
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

