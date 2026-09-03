/**
 * INDOBID — AUTHENTICATION TYPES
 */

export type { UserSession } from './session.service';

export interface SignupDTO {
  email: string;
  username: string;
  displayName?: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AdminLoginDTO {
  email: string;
  secretKey: string;
}
