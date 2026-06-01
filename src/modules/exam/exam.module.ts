import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FlashcardModule } from '../flashcard/flashcard.module';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [DatabaseModule, FlashcardModule],
  controllers: [ExamController],
  providers: [ExamService],
})
export class ExamModule {}
