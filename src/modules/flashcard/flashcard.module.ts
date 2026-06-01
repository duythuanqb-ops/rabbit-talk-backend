import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module';
import { UploadModule } from '../upload/upload.module';
import {
  FlashcardController,
  FlashcardGroupController,
  FlashcardProgressController,
} from './flashcard.controller';
import { FlashcardService } from './flashcard.service';
import { GeminiService } from './services/gemini.service';
import { DictionaryService } from './services/dictionary.service';

@Module({
  imports: [DatabaseModule, UploadModule],
  controllers: [
    FlashcardController,
    FlashcardGroupController,
    FlashcardProgressController,
  ],
  providers: [FlashcardService, GeminiService, DictionaryService, Reflector],
  exports: [GeminiService, DictionaryService],
})
export class FlashcardModule {}
