/**
 * INDOBID — AUTHENTICATION TYPES
 */

export interface UserSession {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin' | 'founder';
  isVerified: boolean;
  isEmailVerified: boolean;
  isSuspended: boolean;
  createdAt: Date;
}

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
