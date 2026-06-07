import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  Post,
  Body,
  Delete,
  Put,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkAdmin(req: any) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('teachers/requests')
  async getTeacherRequests(@Request() req) {
    this.checkAdmin(req);
    return this.adminService.getTeacherRequests();
  }

  @Patch('teachers/requests/:uuid/approve')
  async approveRequest(@Request() req, @Param('uuid') uuid: string) {
    this.checkAdmin(req);
    await this.adminService.approveTeacherRequest(uuid);
    return { message: 'Teacher request approved' };
  }

  @Patch('teachers/requests/:uuid/reject')
  async rejectRequest(@Request() req, @Param('uuid') uuid: string) {
    this.checkAdmin(req);
    await this.adminService.rejectTeacherRequest(uuid);
    return { message: 'Teacher request rejected' };
  }

  @Get('quests')
  async getQuests(@Request() req) {
    this.checkAdmin(req);
    return this.adminService.getQuests();
  }

  @Post('quests')
  async createQuest(
    @Request() req,
    @Body()
    data: {
      title: string;
      description: string;
      xp_reward: number;
      type: string;
      target_value: number;
    },
  ) {
    this.checkAdmin(req);
    return this.adminService.createQuest(data);
  }

  @Put('quests/:id')
  async updateQuest(
    @Request() req,
    @Param('id') id: string,
    @Body()
    data: {
      title: string;
      description: string;
      xp_reward: number;
      type: string;
      target_value: number;
    },
  ) {
    this.checkAdmin(req);
    return this.adminService.updateQuest(id, data);
  }

  @Delete('quests/:id')
  async deleteQuest(@Request() req, @Param('id') id: string) {
    this.checkAdmin(req);
    return this.adminService.deleteQuest(id);
  }
}
