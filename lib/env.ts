// Environment variable validation

import { z } from 'zod';
import { ValidationError } from './errors';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().default('9000'),
  MINIO_USE_SSL: z.string().default('false'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('jewelry-images'),
});

type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validates and returns environment variables
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
      MINIO_PORT: process.env.MINIO_PORT,
      MINIO_USE_SSL: process.env.MINIO_USE_SSL,
      MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
      MINIO_BUCKET: process.env.MINIO_BUCKET,
    });
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = (error as z.ZodError).issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(
        `Environment validation failed: ${missing}`,
        (error as z.ZodError).issues
      );
    }
    throw error;
  }
}

/**
 * Get a specific environment variable with validation
 */
export function getEnvVar(key: keyof Env): string {
  const env = getEnv();
  return env[key];
}

