import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { firebaseUid: string; email: string; name: string; avatarUrl: string | null }) {
    return this.usersService.getMe(user);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: { firebaseUid: string; email: string; name: string; avatarUrl: string | null },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMe(user, dto);
  }
}
