import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { prisma, UserRole } from '@menenwbkam/database';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
export interface AuthRequest extends Request {
  user: { sub: string; role: UserRole; email: string; workspaceId?: string };
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer (\S+)$/.exec(request.headers.authorization || '');
    if (!match) throw new UnauthorizedException('A bearer token is required');
    let sub: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(match[1]);
      if (typeof payload.sub !== 'string') throw new Error('Invalid subject');
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, role: true, email: true },
    });
    if (!user) throw new UnauthorizedException();
    const requestedStore = request.headers['x-store-id'];
    request.user = {
      sub: user.id,
      role: user.role,
      email: user.email,
      workspaceId:
        typeof requestedStore === 'string' ? requestedStore : undefined,
    };
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(user.role))
      throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
