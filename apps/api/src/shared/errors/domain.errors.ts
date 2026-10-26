/**
 * Errores de dominio - independientes del framework.
 * Se traducen a HTTP en la capa de interface vía ExceptionFilter.
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id ${id} not found` : `${resource} not found`);
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
  }
}

export class BusinessRuleError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
  constructor(message = 'Forbidden') {
    super(message);
  }
}

export class ToolExecutionError extends DomainError {
  readonly code = 'TOOL_EXECUTION_ERROR';
  readonly statusCode = 500;
  constructor(
    public readonly toolName: string,
    message: string,
  ) {
    super(`Tool ${toolName} failed: ${message}`);
  }
}

export class LLMError extends DomainError {
  readonly code = 'LLM_ERROR';
  readonly statusCode = 502;
  constructor(
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
  }
}
