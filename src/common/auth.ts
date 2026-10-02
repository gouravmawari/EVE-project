import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../database/prisma.service';
/** Attaches the required roles to a route for RoleGuard to enforce. */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
/** Returns the authenticated user placed on the request by the guards. */
export const CurrentUser = (req: any) => req.user;
@Injectable()
/** Applies Passport's JWT authentication to a request. */
export class JwtGuard extends AuthGuard('jwt') {}
@Injectable()
/** Reloads the authenticated user and enforces any roles declared on the route. */
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}
  /** Rejects missing or inactive users and authorizes the route's required roles. */
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const id = req.user?.id;
    if (!id) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException('User is no longer active');
    req.user = user;
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler()) ?? [];
    if (roles.length && !roles.includes(user.role))
      throw new ForbiddenException();
    return true;
  }
}
