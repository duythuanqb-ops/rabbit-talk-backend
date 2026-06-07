/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('migrate')
  async runMigration() {
    return this.dashboardService.runMigration();
  }

  @Get('teacher/stats')
  getTeacherStats(@Request() req) {
    return this.dashboardService.getTeacherStats(req.user.uuid);
  }

  @Get('teacher/alerts')
  getTeacherAlerts(@Request() req) {
    return this.dashboardService.getTeacherAlerts(req.user.uuid);
  }

  @Get('leaderboard')
  getLeaderboard(@Request() req, @Query('scope') scope: 'global' | 'friends') {
    return this.dashboardService.getLeaderboard(req.user.uuid, scope);
  }

  @Get('profile')
  getProfileStats(@Request() req) {
    return this.dashboardService.getProfileStats(req.user.uuid);
  }

  @Get('student/stats')
  getStudentStats(@Request() req) {
    return this.dashboardService.getStudentStats(req.user.uuid);
  }

  @Get('student/assignments')
  getStudentAssignments(@Request() req) {
    return this.dashboardService.getStudentAssignments(req.user.uuid);
  }

  @Get('student/quests')
  getStudentQuests(@Request() req) {
    return this.dashboardService.getStudentQuests(req.user.uuid);
  }

  @Get('student/attendance')
  getStudentAttendance(@Request() req) {
    return this.dashboardService.getStudentAttendance(req.user.uuid);
  }

  @Post('student/checkin')
  checkInStudent(@Request() req) {
    return this.dashboardService.checkInStudent(req.user.uuid);
  }

  @Get('student/vocabulary')
  getStudentVocabulary(@Request() req) {
    return this.dashboardService.getStudentVocabulary(req.user.uuid);
  }

  @Post('student/vocabulary/star')
  toggleVocabularyStar(
    @Request() req,
    @Query('flashcardId') flashcardId: string,
  ) {
    return this.dashboardService.toggleVocabularyStar(
      req.user.uuid,
      flashcardId,
    );
  }

  @Post('student/vocabulary/custom')
  addCustomWord(
    @Request() req,
    @Body()
    body: {
      word: string;
      meaning?: string;
      phonetic?: string;
      exampleSentence?: string;
    },
  ) {
    return this.dashboardService.addCustomWord(
      req.user.uuid,
      body.word,
      body.meaning,
      body.phonetic,
      body.exampleSentence,
    );
  }

  @Put('student/vocabulary/custom/:id')
  updateCustomWord(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { word: string; meaning?: string },
  ) {
    return this.dashboardService.updateCustomWord(
      id,
      req.user.uuid,
      body.word,
      body.meaning,
    );
  }

  @Delete('student/vocabulary/custom/:id')
  deleteCustomWord(@Request() req, @Param('id') id: string) {
    return this.dashboardService.deleteCustomWord(id, req.user.uuid);
  }

  @Get('student/vocabulary/study')
  getVocabularyStudyCards(@Request() req) {
    return this.dashboardService.getVocabularyStudyCards(req.user.uuid);
  }

  @Post('student/quests/track')
  trackQuestProgress(
    @Request() req,
    @Body() body: { questType: string; increment?: number },
  ) {
    return this.dashboardService.updateQuestProgress(
      req.user.uuid,
      body.questType,
      body.increment || 1,
    );
  }

  @Post('student/quests/clear')
  clearQuests() {
    return this.dashboardService.clearQuests();
  }
}
