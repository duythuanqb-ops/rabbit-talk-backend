import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/user.dto';

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
}
