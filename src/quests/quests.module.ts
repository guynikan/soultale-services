import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

@Module({ imports: [UsersModule], controllers: [QuestsController], providers: [QuestsService] })
export class QuestsModule {}
