import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadImage, getImageUrl, base64ToBuffer } from '@/lib/minio';
import { successResponse, errorResponse, validateRequestBody, getRequiredParam } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const updateReferenceImageSchema = z.object({
  referenceImage: z.string().min(1, 'Reference image is required'),
});

// GET presigned URL for reference image (deprecated - use reference-images API instead)
// This route is kept for backward compatibility but should be migrated to use ReferenceImage model
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    const project = await prisma.project.findUnique({
      where: { id },
      select: { referenceImage: true },
    });

    if (!project) {
      throw new NotFoundError('Project', id);
    }

    // Return empty if no deprecated referenceImage field
    if (!project.referenceImage) {
      throw new NotFoundError('Reference image', undefined);
    }

    // Get presigned URL from MinIO
    const imageUrl = await getImageUrl(project.referenceImage);

    return successResponse({ imageUrl });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH update project reference image (deprecated - use reference-images API instead)
// This route is kept for backward compatibility but should be migrated to use ReferenceImage model
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    const { referenceImage } = await validateRequestBody(request, updateReferenceImageSchema);

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError('Project', id);
    }

    // Convert base64 to buffer and upload to MinIO
    const { buffer, mimeType } = base64ToBuffer(referenceImage);
    const imageId = `reference-${randomBytes(16).toString('hex')}`;
    const objectKey = await uploadImage(buffer, imageId, id, mimeType);

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { referenceImage: objectKey },
    });

    // Get presigned URL for the uploaded image
    const imageUrl = await getImageUrl(objectKey);

    return successResponse({ project: updatedProject, imageUrl });
  } catch (error) {
    return errorResponse(error);
  }
}

