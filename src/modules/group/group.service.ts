/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupService {
  constructor(private readonly db: DatabaseService) {}

  async createGroup(teacherId: string, createGroupDto: CreateGroupDto) {
    const groupId = uuidv4();
    const { title, description, avatar } = createGroupDto;

    await this.db.execute(
      'INSERT INTO `groups` (id, title, description, avatar, created_by) VALUES (?, ?, ?, ?, ?)',
      [groupId, title, description || null, avatar || null, teacherId],
    );

    return this.getGroupById(groupId);
  }

  async getGroupsByTeacher(teacherId: string) {
    return this.db.query(
      'SELECT * FROM `groups` WHERE created_by = ? ORDER BY created_at DESC',
      [teacherId],
    );
  }

  async getGroupsByStudent(studentId: string) {
    const sql = `
      SELECT g.id, g.title, g.description, g.avatar, g.created_at, g.created_by,
             CONCAT(u.first_name, ' ', u.last_name) as instructor,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count
      FROM group_members gm
      JOIN \`groups\` g ON gm.group_id = g.id
      JOIN users u ON g.created_by = u.uuid
      WHERE gm.user_id = ?
      ORDER BY gm.joined_at DESC
    `;
    return this.db.query(sql, [studentId]);
  }

  async getGroupById(groupId: string) {
    const groups = await this.db.query('SELECT * FROM `groups` WHERE id = ?', [
      groupId,
    ]);
    if (!groups.length) {
      throw new NotFoundException('Group not found');
    }
    return groups[0];
  }

  async updateGroup(
    groupId: string,
    teacherId: string,
    updateGroupDto: UpdateGroupDto,
  ) {
    const group = await this.getGroupById(groupId);
    if (group.created_by !== teacherId) {
      throw new ForbiddenException('You can only update your own groups');
    }

    const { title, description, avatar } = updateGroupDto;

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }

    if (updates.length > 0) {
      params.push(groupId);
      await this.db.execute(
        `UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ?`,
        params,
      );
    }

    return this.getGroupById(groupId);
  }

  async deleteGroup(groupId: string, teacherId: string) {
    const group = await this.getGroupById(groupId);
    if (group.created_by !== teacherId) {
      throw new ForbiddenException('You can only delete your own groups');
    }

    await this.db.execute('DELETE FROM `groups` WHERE id = ?', [groupId]);
    return { success: true };
  }

  async addMember(groupId: string, teacherId: string, identifier: string) {
    const group = await this.getGroupById(groupId);
    if (group.created_by !== teacherId) {
      throw new ForbiddenException(
        'You can only add members to your own groups',
      );
    }

    const users = await this.db.query(
      'SELECT uuid FROM users WHERE username = ? OR email = ?',
      [identifier, identifier],
    );
    if (!users.length) {
      throw new NotFoundException('User with this username or email not found');
    }

    const userId = users[0].uuid;

    try {
      const memberId = uuidv4();
      await this.db.execute(
        'INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)',
        [memberId, groupId, userId],
      );
      return { success: true, message: 'Member added' };
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException('User is already a member of this group');
      }
      throw error;
    }
  }

  async removeMember(groupId: string, teacherId: string, userId: string) {
    const group = await this.getGroupById(groupId);
    if (group.created_by !== teacherId) {
      throw new ForbiddenException(
        'You can only remove members from your own groups',
      );
    }

    await this.db.execute(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId],
    );

    return { success: true, message: 'Member removed' };
  }

  async getGroupMembers(groupId: string, userId: string) {
    const group = await this.getGroupById(groupId);

    let isAllowed = group.created_by === userId;

    if (!isAllowed) {
      const membership = await this.db.query(
        'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1',
        [groupId, userId],
      );
      if (membership.length > 0) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      throw new ForbiddenException(
        'You must be a member or teacher of this group to view members',
      );
    }

    return this.db.query(
      `SELECT u.uuid, u.username, u.first_name, u.last_name, u.email, u.avatar_url, gm.joined_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.uuid
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at DESC`,
      [groupId],
    );
  }
}
