/**
 * INDOBID — CREATOR PAYOUT ACCOUNT SERVICE
 * Manages bank and UPI payout methods with strict masking and validation.
 */

import { payoutAccountRepository } from '../../infrastructure/database/repositories/payout-account.repository';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { CreatePayoutAccountDTO } from './earnings.types';

export class PayoutService {
  /**
   * Masks a bank account number showing only last 4 digits (e.g. •••• 4821)
   */
  maskAccountNumber(accountNumber: string): string {
    const clean = accountNumber.replace(/\s+/g, '');
    const last4 = clean.slice(-4);
    return `•••• ${last4}`;
  }

  /**
   * Masks an IFSC code (e.g. HDFC•••••)
   */
  maskIfsc(ifsc: string): string {
    const clean = ifsc.trim().toUpperCase();
    if (clean.length < 4) return clean;
    return `${clean.substring(0, 4)}•••••`;
  }

  /**
   * Masks a UPI VPA (e.g. vi••••@okhdfcbank)
   */
  maskUpi(vpa: string): string {
    const clean = vpa.trim().toLowerCase();
    const parts = clean.split('@');
    if (parts.length !== 2) return clean;
    const [handle, domain] = parts;
    const visiblePrefix = handle.substring(0, 2);
    return `${visiblePrefix}••••@${domain}`;
  }

  async getAccount(userId: string) {
    const account = await payoutAccountRepository.findByUserId(userId);
    if (!account) return null;

    return {
      id: account.id,
      accountType: account.accountType,
      accountHolderName: account.accountHolderName,
      maskedAccountNumber: account.maskedAccountNumber,
      maskedIfsc: account.maskedIfsc,
      status: account.status,
      verifiedAt: account.verifiedAt,
    };
  }

  async saveAccount(userId: string, dto: CreatePayoutAccountDTO) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    let maskedNumber = '';
    let maskedIfscCode: string | null = null;

    if (dto.accountType === 'upi') {
      if (!dto.vpa || !dto.vpa.includes('@')) {
        throw new ValidationError('Valid UPI ID (VPA) is required');
      }
      maskedNumber = this.maskUpi(dto.vpa);
    } else {
      if (!dto.accountNumber || dto.accountNumber.length < 8) {
        throw new ValidationError('Valid bank account number is required (at least 8 digits)');
      }
      if (!dto.ifsc || dto.ifsc.length < 4) {
        throw new ValidationError('Valid IFSC code is required');
      }
      maskedNumber = this.maskAccountNumber(dto.accountNumber);
      maskedIfscCode = this.maskIfsc(dto.ifsc);
    }

    return payoutAccountRepository.upsert(userId, {
      accountType: dto.accountType,
      accountHolderName: dto.accountHolderName.trim(),
      maskedAccountNumber: maskedNumber,
      maskedIfsc: maskedIfscCode,
      status: 'verified',
    });
  }

  async disconnectAccount(userId: string): Promise<boolean> {
    return payoutAccountRepository.deleteByUserId(userId);
  }
}

export const payoutService = new PayoutService();
