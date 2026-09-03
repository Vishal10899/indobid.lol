/**
 * INDOBID — TYPED APPLICATION ERROR HIERARCHY
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;
  constructor(message = 'Invalid request data', errors?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please slow down.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class PaymentError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, 400, 'PAYMENT_ERROR');
  }
}
