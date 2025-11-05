import { NextRequest } from 'next/server';
import { getImageBuffer } from '@/lib/minio';
import { errorResponse } from '@/lib/api-helpers';
import { MinIOError } from '@/lib/errors';

/**
 * Proxy images from MinIO through Next.js API
 * This allows images to work when accessing the app via network IP (e.g., 10.0.0.105:3000)
 * instead of requiring localhost URLs from MinIO presigned URLs
 * 
 * Usage: /api/images/projects/{projectId}/images/{imageId}.{ext}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const pathParams = await params;
    const objectKey = pathParams.path.join('/');

    if (!objectKey) {
      return new Response('Image path is required', { status: 400 });
    }

    // Get image buffer from MinIO
    const imageBuffer = await getImageBuffer(objectKey);

    // Determine content type from file extension
    const extension = objectKey.split('.').pop()?.toLowerCase();
    let contentType = 'image/png'; // default
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
    }

    // Return image with appropriate headers
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    if (error instanceof MinIOError) {
      return new Response('Image not found', { status: 404 });
    }
    return errorResponse(error);
  }
}

