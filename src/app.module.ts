import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { GroupModule } from './modules/group/group.module';
import { FriendModule } from './modules/friend/friend.module';
import { FlashcardModule } from './modules/flashcard/flashcard.module';
import { ExamModule } from './modules/exam/exam.module';

import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/public',
    }),
    UserModule,
    AuthModule,
    DatabaseModule,
    AdminModule,
    GroupModule,
    FriendModule,
    FlashcardModule,
    ExamModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
