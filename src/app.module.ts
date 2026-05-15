import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { CourseModule } from './modules/course/course.module';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [UserModule, AuthModule, CourseModule, DatabaseModule, JobsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
