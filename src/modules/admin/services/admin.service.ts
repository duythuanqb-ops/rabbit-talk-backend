import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../../user/repositories/user.repository';
import { DatabaseService } from '../../../database/database.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly db: DatabaseService,
  ) {}

  async getTeacherRequests() {
    return this.userRepository.getTeacherRequests();
  }

  async approveTeacherRequest(uuid: string) {
    await this.userRepository.updateTeacherRequestStatus(uuid, 'approved');
  }

  async rejectTeacherRequest(uuid: string) {
    await this.userRepository.updateTeacherRequestStatus(uuid, 'rejected');
  }

  async getQuests() {
    return this.db.query('SELECT * FROM daily_quests');
  }

  async createQuest(data: {
    title: string;
    description: string;
    xp_reward: number;
    type: string;
    target_value: number;
  }) {
    const id = uuidv4();
    await this.db.execute(
      `INSERT INTO daily_quests (id, title, description, xp_reward, type, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description,
        data.xp_reward,
        data.type,
        data.target_value,
      ],
    );
    return { id, ...data };
  }

  async updateQuest(
    id: string,
    data: {
      title: string;
      description: string;
      xp_reward: number;
      type: string;
      target_value: number;
    },
  ) {
    await this.db.execute(
      `UPDATE daily_quests SET title = ?, description = ?, xp_reward = ?, type = ?, target_value = ? WHERE id = ?`,
      [
        data.title,
        data.description,
        data.xp_reward,
        data.type,
        data.target_value,
        id,
      ],
    );
    return { id, ...data };
  }

  async deleteQuest(id: string) {
    await this.db.execute('DELETE FROM daily_quests WHERE id = ?', [id]);
    return { success: true };
  }
}
