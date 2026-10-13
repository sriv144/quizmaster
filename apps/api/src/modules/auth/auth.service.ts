import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { hashToken, randomToken } from "../../common/crypto.js";
import { publicUser } from "../../common/http.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./auth.dto.js";
import { EmailService } from "./email.service.js";

interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto, context: ClientContext) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException("An account with this email already exists");
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName.trim(),
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
      },
    });
    return this.createSession(user.id, context);
  }

  async login(dto: LoginDto, context: ClientContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !user.active || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.createSession(user.id, context);
  }

  private async createSession(userId: string, context: ClientContext) {
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const ttlHours = this.config.get<number>("SESSION_TTL_HOURS", 168);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(sessionToken),
        csrfHash: hashToken(csrfToken),
        expiresAt,
        ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 300) } : {}),
      },
      include: { user: true },
    });
    return { sessionToken, csrfToken, expiresAt, user: publicUser(session.user) };
  }

  async logout(sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return publicUser(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (user?.active) {
      const token = randomToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await this.email.sendPasswordReset(user.email, token);
    }
    return { message: "If an account exists, a reset link has been sent." };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new UnauthorizedException("Reset link is invalid or expired");
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash, passwordResetRequired: false, emailVerifiedAt: new Date() },
      }),
      this.prisma.session.deleteMany({ where: { userId: token.userId } }),
    ]);
    return { message: "Password reset. You can now sign in." };
  }
}
