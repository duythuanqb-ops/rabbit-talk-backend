import {
  Controller,
  Request,
  Body,
  Get,
  Post,
  Put,
  Delete,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { ExamService, ExamQuestion } from './exam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  private checkTeacher(
    req: import('express').Request & { user: { uuid: string; role?: string } },
  ) {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      throw new ForbiddenException('Teacher or admin access required');
    }
  }

  @Post('generate')
  generateQuestions(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Body() body: { items: string[] },
  ) {
    this.checkTeacher(req);
    if (!body.items || !body.items.length) {
      throw new BadRequestException(
        'Items array is required to generate questions',
      );
    }
    return this.examService.generateQuestions(body.items, req);
  }

  @Post('enrich-audio')
  enrichAudio(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
  ) {
    this.checkTeacher(req);
    return this.examService.enrichListeningAudioUrls();
  }

  @Get('lookup-word/:word')
  async lookupWord(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('word') word: string,
  ) {
    this.checkTeacher(req);
    const cleaned = word
      .trim()
      .replace(new RegExp('[.,/#!$%^&*;:{}=\\-_`~()]', 'g'), '');
    const res = await this.examService.lookupWordFromDictionary(cleaned);
    if (res && res.audioUrl) {
      res.audioUrl = this.examService.getProxyAudioUrl(req, res.audioUrl) || '';
    }
    return res;
  }

  @Post()
  async createExam(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Body() body: { title?: string; groupId?: string; [key: string]: unknown },
  ) {
    this.checkTeacher(req);
    if (!body.groupId || !body.title) {
      throw new BadRequestException('groupId and title are required');
    }
    const exam = await this.examService.createExam(req.user.uuid, body);
    if (exam && exam.questions) {
      exam.questions = exam.questions.map((q: ExamQuestion) => {
        if (q.audio_url) {
          q.audio_url = this.examService.getProxyAudioUrl(req, q.audio_url);
        }
        return q;
      });
    }
    return exam;
  }

  @Put(':id/publish')
  updatePublishStatus(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('id') id: string,
    @Body('isPublished') isPublished: boolean,
  ) {
    this.checkTeacher(req);
    return this.examService.updatePublishStatus(id, req.user.uuid, isPublished);
  }

  @Put(':id')
  async updateExam(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('id') id: string,
    @Body() body: { title?: string; groupId?: string; [key: string]: unknown },
  ) {
    this.checkTeacher(req);
    if (!body.title) {
      throw new BadRequestException('title is required');
    }
    const exam = await this.examService.updateExam(id, req.user.uuid, body);
    if (exam && exam.questions) {
      exam.questions = exam.questions.map((q: ExamQuestion) => {
        if (q.audio_url) {
          q.audio_url = this.examService.getProxyAudioUrl(req, q.audio_url);
        }
        return q;
      });
    }
    return exam;
  }

  @Get()
  getMyExams(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
  ) {
    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    return this.examService.getMyExams(req.user.uuid, isTeacher);
  }

  @Get('group/:groupId')
  getGroupExams(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('groupId') groupId: string,
  ) {
    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    return this.examService.getExamsByGroup(groupId, req.user.uuid, isTeacher);
  }

  @Get(':id')
  async getExamById(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('id') id: string,
  ) {
    const exam = await this.examService.getExamById(id);
    if (exam && exam.questions) {
      exam.questions = exam.questions.map((q: ExamQuestion) => {
        if (q.audio_url) {
          q.audio_url = this.examService.getProxyAudioUrl(req, q.audio_url);
        }
        return q;
      });
    }
    return exam;
  }

  @Delete(':id')
  deleteExam(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('id') id: string,
  ) {
    this.checkTeacher(req);
    return this.examService.deleteExam(id, req.user.uuid);
  }

  @Post(':id/submit')
  submitAttempt(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('id') id: string,
    @Body() body: { answers: Record<string, string> },
  ) {
    if (req.user.role === 'teacher') {
      throw new ForbiddenException('Teachers cannot submit exam attempts');
    }
    if (!body.answers) {
      throw new BadRequestException('Answers map is required');
    }
    return this.examService.submitAttempt(req.user.uuid, id, body.answers);
  }

  @Get(':id/attempts')
  getAttempts(
    @Request()
    req: import('express').Request & { user: { uuid: string; role?: string } },
    @Param('id') id: string,
  ) {
    return this.examService.getAttemptsByStudent(id, req.user.uuid);
  }
}
