/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
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
  Query,
} from '@nestjs/common';
import { FriendService } from './friend.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendRequestDto } from './dto/send-request.dto';
import { RespondRequestDto } from './dto/respond-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Post('request')
  async sendRequest(@Request() req, @Body() dto: SendRequestDto) {
    return await this.friendService.sendFriendRequest(
      req.user.uuid,
      dto.receiverIdentifier,
    );
  }

  @Get('requests/pending')
  async getPendingRequests(@Request() req) {
    return await this.friendService.getPendingRequests(req.user.uuid);
  }

  @Patch('requests/:id')
  async respondRequest(
    @Request() req,
    @Param('id') requestId: string,
    @Body() dto: RespondRequestDto,
  ) {
    return await this.friendService.respondFriendRequest(
      req.user.uuid,
      requestId,
      dto.accept,
    );
  }

  @Get()
  async getFriends(@Request() req) {
    return await this.friendService.getFriends(req.user.uuid);
  }

  @Delete(':friendUuid')
  async unfriend(@Request() req, @Param('friendUuid') friendUuid: string) {
    return await this.friendService.unfriend(req.user.uuid, friendUuid);
  }

  @Get('search')
  async searchUsers(@Request() req, @Query('q') query: string) {
    return await this.friendService.searchUsers(req.user.uuid, query || '');
  }
}
