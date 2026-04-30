import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { QuestStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { QuestsService } from './quests.service';

@Controller('quests')
export class QuestsController {
  constructor(
    private readonly questsService: QuestsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Query('status') status?: QuestStatus,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.questsService.list(user.id, status);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.questsService.getOne(user.id, id);
  }

  @Patch(':id')
  async patch(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Param('id') id: string,
    @Body() dto: UpdateQuestDto,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.questsService.updateStatus(user.id, id, dto.status);
  }
}
