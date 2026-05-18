import { Controller, Get, Patch, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
}
