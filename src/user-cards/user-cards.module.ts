import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { DeckModule } from '../deck/deck.module';
import { AiModule } from '../ai/ai.module';
import { UserCardsController } from './user-cards.controller';
import { UserCardsService } from './user-cards.service';
import { CardUnlockPolicy } from './card-unlock.policy';

@Module({
  imports: [UsersModule, DeckModule, AiModule],
  controllers: [UserCardsController],
  providers: [UserCardsService, CardUnlockPolicy],
  exports: [UserCardsService, CardUnlockPolicy],
})
export class UserCardsModule {}
