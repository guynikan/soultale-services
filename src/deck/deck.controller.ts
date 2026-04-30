import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { DeckService } from './deck.service';

@Controller('deck')
export class DeckController {
  constructor(
    private readonly deckService: DeckService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(@CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null }) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.deckService.getDeckForUser(user.id);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.deckService.getDeckCardForUser(user.id, id);
  }
}
