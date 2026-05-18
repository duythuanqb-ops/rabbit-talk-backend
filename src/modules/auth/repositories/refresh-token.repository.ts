import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly db: DatabaseService) {}

  async upsert(
    userUuid: string,
    token: string,
    expiresAt: Date,
    deviceInfo: string,
    ipAddress: string,
  ) {
    const sql = `
      INSERT INTO refresh_tokens (user_uuid, token, expires_at, device_info, ip_address)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        token = VALUES(token),
        expires_at = VALUES(expires_at),
        ip_address = VALUES(ip_address),
        is_revoked = FALSE,
        last_active = CURRENT_TIMESTAMP
    `;
    await this.db.execute(sql, [
      userUuid,
      token,
      expiresAt,
      deviceInfo,
      ipAddress,
    ]);
  }

  async findValidToken(token: string) {
    const sql = `
      SELECT rt.*, u.username, u.email, u.first_name, u.last_name, u.role
      FROM refresh_tokens rt
      JOIN users u ON rt.user_uuid = u.uuid
      WHERE rt.token = ? AND rt.is_revoked = FALSE AND rt.expires_at > NOW()
      LIMIT 1
    `;
    const results = await this.db.query(sql, [token]);
    return results[0] || null;
  }

  async updateLastActive(token: string) {
    const sql = 'UPDATE refresh_tokens SET last_active = NOW() WHERE token = ?';
    await this.db.execute(sql, [token]);
  }

  async revokeToken(token: string) {
    const sql = 'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = ?';
    await this.db.execute(sql, [token]);
  }
}
