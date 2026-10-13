import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthGuard } from "../../common/auth.guard.js";
import type { AuthenticatedRequest } from "../../common/auth.types.js";
import { AuthService } from "./auth.service.js";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./auth.dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.register(dto, this.clientContext(request));
    this.setCookies(reply, result.sessionToken, result.csrfToken, result.expiresAt);
    return { user: result.user };
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(dto, this.clientContext(request));
    this.setCookies(reply, result.sessionToken, result.csrfToken, result.expiresAt);
    return { user: result.user };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.principal.userId);
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(request.principal.sessionId);
    reply.clearCookie("qm_session", { path: "/" });
    reply.clearCookie("qm_csrf", { path: "/" });
    return { message: "Signed out" };
  }

  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post("reset-password")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  private clientContext(request: FastifyRequest) {
    const userAgent = request.headers["user-agent"];
    return {
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
  }

  private setCookies(reply: FastifyReply, sessionToken: string, csrfToken: string, expires: Date) {
    const secure = process.env.NODE_ENV === "production";
    reply.setCookie("qm_session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "lax",
      expires,
    });
    reply.setCookie("qm_csrf", csrfToken, {
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "lax",
      expires,
    });
  }
}
