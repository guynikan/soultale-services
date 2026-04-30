import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UserCardsService } from './user-cards.service';

@Controller('user-cards')
export class UserCardsController {
  constructor(
    private readonly userCardsService: UserCardsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('questId') questId?: string,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    const resolvedPage = Math.max(Number(page) || 1, 1);
    const resolvedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    return this.userCardsService.list(user.id, resolvedPage, resolvedLimit, questId);
  }

  @Get(':id')
  async getById(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.userCardsService.getById(user.id, id);
  }
}
