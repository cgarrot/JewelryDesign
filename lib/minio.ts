import { Client } from 'minio';
import { getEnv } from './env';
import { MinIOError, logError } from './errors';

// Lazy initialization - avoid side effects on module load
let minioClient: Client | null = null;
let bucketName: string | null = null;
let bucketInitialized = false;

/**
 * Get or create MinIO client instance
 */
function getMinioClient(): Client {
  if (!minioClient) {
    const env = getEnv();
    minioClient = new Client({
      endPoint: env.MINIO_ENDPOINT,
      port: parseInt(env.MINIO_PORT, 10),
      useSSL: env.MINIO_USE_SSL === 'true',
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
    bucketName = env.MINIO_BUCKET;
  }
  return minioClient;
}

/**
 * Get bucket name
 */
function getBucketName(): string {
  if (!bucketName) {
    const env = getEnv();
    bucketName = env.MINIO_BUCKET;
  }
  return bucketName;
}

// Note: URL cache removed - we now use Next.js API proxy routes
// which don't require caching since they're always accessible

/**
 * Initialize bucket - create if it doesn't exist
 * This should be called explicitly, not on module load
 */
export async function ensureBucketExists(): Promise<void> {
  if (bucketInitialized) {
    return;
  }

  try {
    const client = getMinioClient();
    const bucket = getBucketName();
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1');
      console.log(`Bucket ${bucket} created successfully`);
    }
    bucketInitialized = true;
  } catch (error) {
    logError(error, 'MinIO ensureBucketExists');
    throw new MinIOError('Failed to ensure bucket exists', error);
  }
}

/**
 * Upload an image to MinIO
 * @param buffer - Image buffer
 * @param imageId - Unique image ID
 * @param projectId - Project ID for organizing images
 * @param mimeType - Image MIME type (e.g., 'image/png', 'image/jpeg')
 * @returns Object key for the uploaded image
 */
export async function uploadImage(
  buffer: Buffer,
  imageId: string,
  projectId: string,
  mimeType: string = 'image/png'
): Promise<string> {
  try {
    await ensureBucketExists();
    const client = getMinioClient();
    const bucket = getBucketName();

    // Determine file extension from MIME type
    const extension = mimeType.split('/')[1] || 'png';
    const objectKey = `projects/${projectId}/images/${imageId}.${extension}`;

    // Upload to MinIO
    await client.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    console.log(`Image uploaded successfully: ${objectKey}`);
    return objectKey;
  } catch (error) {
    logError(error, 'MinIO uploadImage');
    throw new MinIOError('Failed to upload image', error);
  }
}

/**
 * Get a URL for an image (proxied through Next.js API for network compatibility)
 * @param objectKey - MinIO object key
 * @param expiry - URL expiry time in seconds (not used for API proxy, kept for compatibility)
 * @returns Relative URL to the Next.js API image proxy
 */
export async function getImageUrl(
  objectKey: string,
  expiry: number = 24 * 60 * 60
): Promise<string> {
  // Use Next.js API proxy route instead of MinIO presigned URLs
  // This ensures images work when accessing via network IP (e.g., 10.0.0.105:3000)
  // instead of requiring localhost URLs from MinIO
  return `/api/images/${objectKey}`;
}

/**
 * Delete an image from MinIO
 * @param objectKey - MinIO object key
 */
export async function deleteImage(objectKey: string): Promise<void> {
  try {
    await ensureBucketExists();
    const client = getMinioClient();
    const bucket = getBucketName();
    await client.removeObject(bucket, objectKey);

    console.log(`Image deleted successfully: ${objectKey}`);
  } catch (error) {
    logError(error, 'MinIO deleteImage');
    throw new MinIOError('Failed to delete image', error);
  }
}

/**
 * Get image as a buffer
 * @param objectKey - MinIO object key
 * @returns Image buffer
 */
export async function getImageBuffer(objectKey: string): Promise<Buffer> {
  try {
    await ensureBucketExists();
    const client = getMinioClient();
    const bucket = getBucketName();
    const stream = await client.getObject(bucket, objectKey);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  } catch (error) {
    logError(error, 'MinIO getImageBuffer');
    throw new MinIOError('Failed to get image buffer', error);
  }
}

/**
 * Convert ImageFormat enum to MIME type
 * @param format - ImageFormat enum value
 * @returns MIME type string
 */
export function imageFormatToMimeType(format: 'PNG' | 'JPEG' | 'WEBP'): string {
  switch (format) {
    case 'PNG':
      return 'image/png';
    case 'JPEG':
      return 'image/jpeg';
    case 'WEBP':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

/**
 * Convert base64 string to buffer
 * @param base64String - Base64 encoded image string
 * @returns Object with buffer and mime type
 */
export function base64ToBuffer(base64String: string): { buffer: Buffer; mimeType: string } {
  // Check if it's a data URL
  if (base64String.startsWith('data:')) {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 data URL');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    return { buffer, mimeType };
  } else {
    // Plain base64 string, assume PNG
    const buffer = Buffer.from(base64String, 'base64');
    return { buffer, mimeType: 'image/png' };
  }
}
