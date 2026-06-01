import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Reflector } from '@nestjs/core';
import { FlashcardService } from './flashcard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// ---------------------------------------------------------------------------
// Flashcard Sets
// ---------------------------------------------------------------------------

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('flashcard-sets')
export class FlashcardController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Post('parse-ocr')
  async parseOcrText(@Body('text') text: string) {
    return this.flashcardService.parseOcrText(text);
  }

  @Post('parse-image')
  @UseInterceptors(FileInterceptor('image'))
  async parseImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new ForbiddenException('No image file provided.');
    }
    return this.flashcardService.parseImageWithVision(
      file.buffer,
      file.mimetype,
    );
  }

  @Get()
  async getMySets(@Request() req) {
    return this.flashcardService.getMySets(req.user.uuid, req.user.role);
  }

  @Get(':setId/cards')
  async getCardsForSet(@Param('setId') setId: string, @Request() req) {
    return this.flashcardService.getCardsForSet(setId, req.user.uuid);
  }

  @Post(':setId/cards')
  async addCard(@Param('setId') setId: string, @Body('word') word: string) {
    return this.flashcardService.addFlashcard(setId, word);
  }

  @Put(':setId')
  @Roles('teacher', 'admin')
  async updateSet(
    @Param('setId') setId: string,
    @Body() body: { title: string; description: string },
  ) {
    return this.flashcardService.updateSet(
      setId,
      body.title,
      body.description ?? '',
    );
  }

  @Delete(':setId')
  @Roles('teacher', 'admin')
  async deleteSet(@Param('setId') setId: string) {
    return this.flashcardService.deleteSet(setId);
  }

  @Patch(':setId/publish')
  @Roles('teacher', 'admin')
  async updatePublishStatus(
    @Param('setId') setId: string,
    @Body('is_published') isPublished: boolean,
  ) {
    return this.flashcardService.updatePublishStatus(setId, isPublished);
  }
}

// ---------------------------------------------------------------------------
// Flashcard Sets nested under Groups
// ---------------------------------------------------------------------------

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class FlashcardGroupController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Post(':groupId/flashcard-sets')
  @Roles('teacher', 'admin')
  async createSet(
    @Param('groupId') groupId: string,
    @Request() req,
    @Body() body: { title: string; description: string },
  ) {
    return this.flashcardService.createSet(
      req.user.uuid,
      groupId,
      body.title,
      body.description ?? '',
    );
  }
}

// ---------------------------------------------------------------------------
// Individual Flashcards
// ---------------------------------------------------------------------------

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('flashcards')
export class FlashcardProgressController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Patch(':cardId/progress')
  async updateProgress(
    @Param('cardId') cardId: string,
    @Request() req,
    @Body('status') status: 'learning' | 'mastered',
  ) {
    return this.flashcardService.updateProgress(req.user.uuid, cardId, status);
  }

  @Put(':cardId')
  @Roles('teacher', 'admin')
  async updateFlashcard(
    @Param('cardId') cardId: string,
    @Body()
    body: {
      word: string;
      phonetic: string;
      part_of_speech: string;
      meaning: string;
      synonyms: string;
      example_sentence: string;
    },
  ) {
    return this.flashcardService.updateFlashcard(
      cardId,
      body.word,
      body.phonetic ?? '',
      body.part_of_speech ?? '',
      body.meaning ?? '',
      body.synonyms ?? '',
      body.example_sentence ?? '',
    );
  }

  @Delete(':cardId')
  @Roles('teacher', 'admin')
  async deleteFlashcard(@Param('cardId') cardId: string) {
    return this.flashcardService.deleteFlashcard(cardId);
  }
}
