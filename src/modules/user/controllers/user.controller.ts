/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import {
  CreateUserDto,
  UpdateProfileDto,
  UpdatePasswordDto,
} from '../dto/user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return await this.userService.create(dto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return await this.userService.updateProfile(req.user.uuid, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('password')
  async updatePassword(@Request() req, @Body() dto: UpdatePasswordDto) {
    return await this.userService.updatePassword(req.user.uuid, dto);
  }
}
