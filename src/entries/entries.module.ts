import { Module } from '@nestjs/common';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { UsersModule } from '../users/users.module';
import { UserCardsModule } from '../user-cards/user-cards.module';

@Module({ imports: [UsersModule, UserCardsModule], controllers: [EntriesController], providers: [EntriesService] })
export class EntriesModule {}
