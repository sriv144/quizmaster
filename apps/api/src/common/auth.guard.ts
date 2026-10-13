import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { hashToken } from "./crypto.js";
import { ROLES_KEY } from "./roles.decorator.js";
import type { Role } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest & { principal?: unknown }>();
    const token = request.cookies.qm_session;
    if (!token) throw new UnauthorizedException("Authentication required");

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active) {
      throw new UnauthorizedException("Session expired");
    }

    if (!SAFE_METHODS.has(request.method)) {
      const csrf = request.headers["x-csrf-token"];
      if (typeof csrf !== "string" || hashToken(csrf) !== session.csrfHash) {
        throw new ForbiddenException("Invalid CSRF token");
      }
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(session.user.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    request.principal = {
      userId: session.user.id,
      sessionId: session.id,
      role: session.user.role,
      email: session.user.email,
    };
    return true;
  }
}
