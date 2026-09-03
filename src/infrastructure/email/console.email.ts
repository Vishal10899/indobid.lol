/**
 * INDOBID — CONSOLE EMAIL PROVIDER (TEST / LOCAL DEV)
 */

import { IEmailProvider, SendEmailParams, SendEmailResult } from './email.interface';

export class ConsoleEmailProvider implements IEmailProvider {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    console.log('--- [Transactional Email] ---');
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Body: ${params.html}`);
    console.log('-----------------------------');

    return {
      success: true,
      messageId: `console_${Date.now()}`,
    };
  }
}

export const consoleEmailProvider = new ConsoleEmailProvider();
