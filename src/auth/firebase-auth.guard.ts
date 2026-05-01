import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Auth } from 'firebase-admin/auth';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { FIREBASE_AUTH } from './firebase-admin.provider';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown; url?: string }>();
    const url = request.url ?? '';
    if (url.startsWith('/docs') || url.startsWith('/docs-json')) {
      return true;
    }
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();

    try {
      const decoded = await this.auth.verifyIdToken(token);
      request.user = {
        firebaseUid: decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown.local`,
        name: decoded.name ?? decoded.email ?? 'SoulTale User',
        avatarUrl: decoded.picture ?? null,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
