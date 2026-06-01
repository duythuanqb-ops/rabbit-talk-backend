import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FriendService {
  constructor(private readonly db: DatabaseService) {}

  async sendFriendRequest(senderUuid: string, receiverIdentifier: string) {
    const users = await this.db.query(
      'SELECT uuid, username FROM users WHERE username = ? OR email = ? LIMIT 1',
      [receiverIdentifier, receiverIdentifier],
    );

    if (!users.length) {
      throw new NotFoundException('User not found');
    }

    const receiverUuid = users[0].uuid;

    if (senderUuid === receiverUuid) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }
    const relations = await this.db.query(
      'SELECT * FROM friendships WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) LIMIT 1',
      [senderUuid, receiverUuid, receiverUuid, senderUuid],
    );

    if (relations.length > 0) {
      const relation = relations[0];
      if (relation.status === 'accepted') {
        throw new BadRequestException('You are already friends');
      }
      if (relation.status === 'pending') {
        if (relation.sender_id === senderUuid) {
          throw new BadRequestException('Friend request already sent');
        } else {
          await this.db.execute(
            'UPDATE friendships SET status = "accepted" WHERE id = ?',
            [relation.id],
          );
          return {
            success: true,
            status: 'accepted',
            message: 'Friend request accepted automatically',
          };
        }
      }
      if (relation.status === 'declined') {
        await this.db.execute(
          'UPDATE friendships SET sender_id = ?, receiver_id = ?, status = "pending" WHERE id = ?',
          [senderUuid, receiverUuid, relation.id],
        );
        return {
          success: true,
          status: 'pending',
          message: 'Friend request re-sent',
        };
      }
    }

    const id = randomUUID();
    await this.db.execute(
      'INSERT INTO friendships (id, sender_id, receiver_id, status) VALUES (?, ?, ?, "pending")',
      [id, senderUuid, receiverUuid],
    );

    return {
      success: true,
      status: 'pending',
      message: 'Friend request sent successfully',
    };
  }

  async getPendingRequests(userUuid: string) {
    const sql = `
      SELECT 
        f.id AS request_id, 
        u.uuid, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.avatar_url, 
        u.bio, 
        f.created_at,
        IF(f.sender_id = ?, 'outgoing', 'incoming') AS direction
      FROM friendships f 
      JOIN users u ON (f.sender_id = u.uuid OR f.receiver_id = u.uuid)
      WHERE (f.receiver_id = ? OR f.sender_id = ?) 
        AND f.status = 'pending' 
        AND u.uuid != ?
      ORDER BY f.created_at DESC
    `;
    return this.db.query(sql, [userUuid, userUuid, userUuid, userUuid]);
  }

  async respondFriendRequest(
    userUuid: string,
    requestId: string,
    accept: boolean,
  ) {
    const requests = await this.db.query(
      'SELECT * FROM friendships WHERE id = ? AND receiver_id = ? AND status = "pending" LIMIT 1',
      [requestId, userUuid],
    );

    if (!requests.length) {
      throw new NotFoundException(
        'Friend request not found or already processed',
      );
    }

    if (accept) {
      await this.db.execute(
        'UPDATE friendships SET status = "accepted" WHERE id = ?',
        [requestId],
      );
      return { success: true, message: 'Friend request accepted' };
    } else {
      await this.db.execute('DELETE FROM friendships WHERE id = ?', [
        requestId,
      ]);
      return { success: true, message: 'Friend request declined' };
    }
  }

  async getFriends(userUuid: string) {
    const sql = `
      SELECT 
        f.id AS friendship_id, 
        u.uuid, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.avatar_url, 
        u.bio, 
        u.role 
      FROM friendships f 
      JOIN users u ON (f.sender_id = u.uuid OR f.receiver_id = u.uuid) 
      WHERE (f.sender_id = ? OR f.receiver_id = ?) 
        AND f.status = 'accepted' 
        AND u.uuid != ?
      ORDER BY u.first_name ASC, u.last_name ASC
    `;
    return this.db.query(sql, [userUuid, userUuid, userUuid]);
  }

  async unfriend(userUuid: string, friendUuid: string) {
    const result = await this.db.execute(
      `DELETE FROM friendships 
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`,
      [userUuid, friendUuid, friendUuid, userUuid],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException('Friendship or friend request not found');
    }

    return {
      success: true,
      message: 'Unfriended successfully or request cancelled',
    };
  }

  async searchUsers(userUuid: string, query: string) {
    const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
    const sql = `
      SELECT 
        u.uuid, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.avatar_url, 
        u.bio, 
        u.role,
        f.id AS friendship_id,
        f.status AS friendship_status,
        f.sender_id AS friendship_sender
      FROM users u
      LEFT JOIN friendships f ON 
        (f.sender_id = ? AND f.receiver_id = u.uuid) OR 
        (f.sender_id = u.uuid AND f.receiver_id = ?)
      WHERE (u.username = ? OR u.email = ?)
        AND u.uuid != ?
        AND u.role != 'admin'
      LIMIT 15
    `;
    return this.db.query(sql, [
      userUuid,
      userUuid,
      cleanQuery,
      cleanQuery,
      userUuid,
    ]);
  }
}
