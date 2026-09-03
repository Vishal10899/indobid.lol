/**
 * INDOBID — EMAIL PROVIDER INTERFACE
 * Abstraction enabling vendor-agnostic transactional email dispatch (Resend, SES, SendGrid, SMTP)
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailProvider {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}
