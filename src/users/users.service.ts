import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveLevel } from '../config/level.utils';

type AuthUser = { firebaseUid: string; email: string; name: string; avatarUrl: string | null };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromAuth(authUser: AuthUser): Promise<User> {
    return this.prisma.user.upsert({
      where: { firebaseUid: authUser.firebaseUid },
      update: {
        email: authUser.email,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
      },
      create: {
        firebaseUid: authUser.firebaseUid,
        email: authUser.email,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
      },
    });
  }

  async getMe(authUser: AuthUser): Promise<User> {
    return this.upsertFromAuth(authUser);
  }

  async updateMe(authUser: AuthUser, update: Prisma.UserUpdateInput): Promise<User> {
    const user = await this.upsertFromAuth(authUser);
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: update });

    const resolved = resolveLevel(updated.xp);
    if (updated.level !== resolved.level || updated.levelName !== resolved.levelName) {
      return this.prisma.user.update({
        where: { id: updated.id },
        data: { level: resolved.level, levelName: resolved.levelName },
      });
    }

    return updated;
  }
}
