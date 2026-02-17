// ============================================================================
// Mail Service -- SMTP email sending
// ============================================================================

import nodemailer from 'nodemailer';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('mail-service');

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}

class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check if SMTP is configured
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
      logger.warn('SMTP not fully configured. Email sending disabled.', {
        hasHost: !!config.SMTP_HOST,
        hasUser: !!config.SMTP_USER,
        hasPass: !!config.SMTP_PASS,
      });
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465, // Use TLS for port 465, STARTTLS for 587
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });

      this.isConfigured = true;
      logger.info('Mail service initialized', {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
      });
    } catch (error) {
      logger.error('Failed to initialize mail service', { error });
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email sending attempted but SMTP not configured', { to: options.to });
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: options.from || config.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
        headers: {
          'X-Service': 'complaint-triage-platform',
          'X-Mailer': 'NodemailerService/1.0',
        },
      });

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendCommunication(
    recipientEmail: string,
    subject: string,
    body: string,
    communicationType: 'email_to_complainant' | 'email_to_business',
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const htmlBody = this.formatEmailBody(body, communicationType);

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html: htmlBody,
    });
  }

  private formatEmailBody(body: string, communicationType: 'email_to_complainant' | 'email_to_business'): string {
    const headerText = communicationType === 'email_to_complainant'
      ? 'Complaint Response'
      : 'Complaint Notice';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003d7a; color: white; padding: 20px; border-radius: 4px 4px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 4px 4px; }
            .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${headerText}</h2>
            </div>
            <div class="content">
              ${body.split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('')}
            </div>
            <div class="footer">
              <p>This is an automated message from the Australian Regulatory Complaint Triage System.</p>
              <p>Please do not reply to this email. Use the complaint portal for further communication.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

let mailService: MailService | null = null;

export function getMailService(): MailService {
  if (!mailService) {
    mailService = new MailService();
  }
  return mailService;
}
