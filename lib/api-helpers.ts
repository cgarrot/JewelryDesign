// API helper utilities for consistent request/response handling

import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, AppError } from './errors';
import { ApiResponse } from './types';

/**
 * Creates a success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ ...data } as ApiResponse<T>, { status });
}

/**
 * Creates an error response
 */
export function errorResponse(
  error: unknown,
  defaultMessage: string = 'An error occurred',
  defaultStatus: number = 500
): NextResponse {
  const { error: message, details, status } = createErrorResponse(
    error,
    defaultMessage
  );
  return NextResponse.json(
    {
      error: message,
      ...(details && { details }),
    } as ApiResponse,
    { status: status || defaultStatus }
  );
}

/**
 * Wraps an API handler with error handling
 */
export function withErrorHandling<T = unknown>(
  handler: (request: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: T) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Validates request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', error);
  }
}

/**
 * Gets a required parameter from route params
 */
export async function getRequiredParam(
  params: Promise<{ [key: string]: string }>,
  key: string
): Promise<string> {
  const resolved = await params;
  const value = resolved[key];
  if (!value) {
    throw new AppError(`Missing required parameter: ${key}`, 400);
  }
  return value;
}

