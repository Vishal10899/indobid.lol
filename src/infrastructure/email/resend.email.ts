/**
 * INDOBID — RESEND EMAIL PROVIDER IMPLEMENTATION
 */

import { IEmailProvider, SendEmailParams, SendEmailResult } from './email.interface';
import { env } from '../../config/env';

export class ResendEmailProvider implements IEmailProvider {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { to, subject, html, from } = params;
    const apiKey = env.RESEND_API_KEY;
    const sender = from || env.EMAIL_FROM;

    if (!apiKey) {
      if (env.isProduction) {
        return {
          success: false,
          error: 'Transactional email service is not configured on server',
        };
      }
      // In local dev/test fallback to console log
      console.log(`[Email Dispatch Mock] To: ${to} | Subject: ${subject}`);
      return { success: true, messageId: `mock_${Date.now()}` };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [to],
          subject,
          html,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to send email via Resend',
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error sending email',
      };
    }
  }
}

export const resendEmailProvider = new ResendEmailProvider();
