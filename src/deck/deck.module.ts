import { Module } from '@nestjs/common';
import { DeckController } from './deck.controller';
import { DeckService } from './deck.service';
import { UsersModule } from '../users/users.module';

@Module({ imports: [UsersModule], controllers: [DeckController], providers: [DeckService], exports: [DeckService] })
export class DeckModule {}
