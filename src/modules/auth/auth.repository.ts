/**
 * INDOBID — AUTHENTICATION REPOSITORY
 * Centralizes data persistence for user registration, authentication credentials, and verification tokens.
 */

import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { otpRepository } from '../../infrastructure/database/repositories/otp.repository';
import { passwordResetRepository } from '../../infrastructure/database/repositories/password-reset.repository';

export class AuthRepository {
  readonly users = userRepository;
  readonly otps = otpRepository;
  readonly passwordResets = passwordResetRepository;

  async findUserByEmail(email: string) {
    return this.users.findByEmail(email);
  }

  async findUserByUsername(username: string) {
    return this.users.findByUsername(username);
  }

  async findUserById(id: string) {
    return this.users.findById(id);
  }

  async createUser(data: Parameters<typeof userRepository.create>[0]) {
    return this.users.create(data);
  }

  async updateUser(id: string, data: Parameters<typeof userRepository.update>[1]) {
    return this.users.update(id, data);
  }
}

export const authRepository = new AuthRepository();
