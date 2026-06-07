import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FlashcardModule } from '../flashcard/flashcard.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [DatabaseModule, FlashcardModule, forwardRef(() => DashboardModule)],
  controllers: [ExamController],
  providers: [ExamService],
})
export class ExamModule {}
