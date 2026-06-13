import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import config from '../../config';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
    });
  }

  async sendEmailVerification(to: string, otp: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your verification code – RibbitTalk</title>
      </head>
      <body style="margin:0;padding:0;background:#f0fdf4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">🐰 RibbitTalk</h1>
                    <p style="margin:8px 0 0;color:#d1fae5;font-size:13px;">Language learning made fun</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 20px;">
                    <h2 style="margin:0 0 10px;color:#111827;font-size:20px;font-weight:700;">Verify your email address</h2>
                    <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;">
                      Enter the code below in the RibbitTalk app to verify your email. 
                      The code expires in <strong>5 minutes</strong>.
                    </p>
                    <!-- OTP Block -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:0 0 28px;">
                          <div style="display:inline-block;background:#f0fdf4;border:2px solid #10b981;border-radius:14px;padding:20px 40px;">
                            <p style="margin:0 0 6px;color:#6b7280;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Your verification code</p>
                            <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#065f46;font-family:'Courier New',monospace;">${otp}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 40px 28px;text-align:center;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;color:#d1d5db;font-size:11px;">
                      This code will expire in 5 minutes for your security.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: config.mail.from,
        to,
        subject: `${otp} is your RibbitTalk verification code`,
        html,
      });
      this.logger.log(`Verification OTP sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification OTP to ${to}`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, otp: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your password – RibbitTalk</title>
      </head>
      <body style="margin:0;padding:0;background:#f0fdf4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">🐰 RibbitTalk</h1>
                    <p style="margin:8px 0 0;color:#d1fae5;font-size:13px;">Language learning made fun</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 20px;">
                    <h2 style="margin:0 0 10px;color:#111827;font-size:20px;font-weight:700;">Reset your password</h2>
                    <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;">
                      Use the code below to reset your password on RibbitTalk. 
                      The code expires in <strong>5 minutes</strong>.
                    </p>
                    <!-- OTP Block -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:0 0 28px;">
                          <div style="display:inline-block;background:#f0fdf4;border:2px solid #10b981;border-radius:14px;padding:20px 40px;">
                            <p style="margin:0 0 6px;color:#6b7280;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Your reset code</p>
                            <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#065f46;font-family:'Courier New',monospace;">${otp}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                      If you didn't request a password reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 40px 28px;text-align:center;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;color:#d1d5db;font-size:11px;">
                      This code will expire in 5 minutes for your security.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: config.mail.from,
        to,
        subject: `${otp} is your RibbitTalk password reset code`,
        html,
      });
      this.logger.log(`Password reset OTP sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset OTP to ${to}`, error);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
