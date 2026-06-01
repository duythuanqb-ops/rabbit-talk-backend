import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GroupService } from './group.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMemberDto } from './dto/add-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly uploadService: UploadService,
  ) {}

  private checkTeacher(req: any) {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      throw new ForbiddenException('Teacher or admin access required');
    }
  }

  @Post()
  create(@Request() req, @Body() createGroupDto: CreateGroupDto) {
    this.checkTeacher(req);
    return this.groupService.createGroup(req.user.uuid, createGroupDto);
  }

  @Get()
  findAll(@Request() req) {
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      return this.groupService.getGroupsByTeacher(req.user.uuid);
    } else {
      return this.groupService.getGroupsByStudent(req.user.uuid);
    }
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    this.checkTeacher(req);
    return this.groupService.getGroupById(id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    this.checkTeacher(req);
    return this.groupService.updateGroup(id, req.user.uuid, updateGroupDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    this.checkTeacher(req);
    return this.groupService.deleteGroup(id, req.user.uuid);
  }

  @Get(':id/members')
  getMembers(@Request() req, @Param('id') id: string) {
    return this.groupService.getGroupMembers(id, req.user.uuid);
  }

  @Post(':id/members')
  addMember(
    @Request() req,
    @Param('id') id: string,
    @Body() addMemberDto: AddMemberDto,
  ) {
    this.checkTeacher(req);
    return this.groupService.addMember(
      id,
      req.user.uuid,
      addMemberDto.identifier,
    );
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Request() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    this.checkTeacher(req);
    return this.groupService.removeMember(id, req.user.uuid, userId);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.checkTeacher(req);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const avatarUrl = await this.uploadService.uploadAvatar(file);
    const group = await this.groupService.updateGroup(id, req.user.uuid, {
      avatar: avatarUrl,
    });
    return {
      message: 'Group avatar updated successfully',
      avatar: avatarUrl,
      group,
    };
  }
}
