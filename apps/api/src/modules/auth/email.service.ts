import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const key = config.get<string>("RESEND_API_KEY");
    this.resend = key ? new Resend(key) : null;
  }

  async sendPasswordReset(email: string, token: string) {
    const origin = this.config.get<string>("APP_ORIGIN", "http://localhost:5173");
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    if (!this.resend) {
      if (this.config.get("NODE_ENV") === "production") {
        this.logger.warn("Password reset email skipped: email delivery is not configured");
        return;
      }
      this.logger.log(`Development password-reset link for ${email}: ${resetUrl}`);
      return;
    }
    const result = await this.resend.emails.send({
      from: this.config.get<string>("EMAIL_FROM", "QuizMaster <no-reply@example.com>"),
      to: email,
      subject: "Reset your QuizMaster password",
      html: `<p>Use this link to reset your QuizMaster password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes.</p>`,
    });
    if (result.error) {
      this.logger.error(`Password reset email delivery failed: ${result.error.name}`);
    }
  }
}
