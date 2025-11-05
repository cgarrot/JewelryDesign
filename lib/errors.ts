// Centralized error handling utilities

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
    this.name = 'NotFoundError';
  }
}

export class MinIOError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, 'MINIO_ERROR', details);
    this.name = 'MinIOError';
  }
}

/**
 * Logs an error with context
 */
export function logError(error: unknown, context?: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(
    context ? `[${context}] Error: ${errorMessage}` : `Error: ${errorMessage}`,
    errorStack || error
  );
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = 'An error occurred'
): { error: string; details?: string; status: number } {
  if (error instanceof AppError) {
    return {
      error: error.message,
      details: error.details ? String(error.details) : undefined,
      status: error.statusCode,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  logError(error);

  return {
    error: message || defaultMessage,
    status: 500,
  };
}

