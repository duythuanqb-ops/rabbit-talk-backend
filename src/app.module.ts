import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
