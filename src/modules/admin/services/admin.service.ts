import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../user/repositories/user.repository';

@Injectable()
export class AdminService {
  constructor(private readonly userRepository: UserRepository) {}

  async getTeacherRequests() {
    return this.userRepository.getTeacherRequests();
  }

  async approveTeacherRequest(uuid: string) {
    await this.userRepository.updateTeacherRequestStatus(uuid, 'approved');
  }

  async rejectTeacherRequest(uuid: string) {
    await this.userRepository.updateTeacherRequestStatus(uuid, 'rejected');
  }
}
