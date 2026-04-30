import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { EntriesService } from './entries.service';

@Controller('entries')
export class EntriesController {
  constructor(
    private readonly entriesService: EntriesService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async create(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Body() dto: CreateEntryDto,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.entriesService.createEntry({ userId: user.id, transcription: dto.transcription, durationSecs: dto.durationSecs });
  }

  @Get()
  async list(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    const resolvedPage = Math.max(Number(page) || 1, 1);
    const resolvedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    return this.entriesService.listEntries(user.id, resolvedPage, resolvedLimit);
  }

  @Get(':id')
  async getById(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    return this.entriesService.getEntry(user.id, id);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() authUser: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.upsertFromAuth(authUser);
    await this.entriesService.deleteEntry(user.id, id);
  }
}
