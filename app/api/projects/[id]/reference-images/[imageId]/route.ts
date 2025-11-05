import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { deleteImage } from '@/lib/minio';
import { successResponse, errorResponse, validateRequestBody, getRequiredParam } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { logError } from '@/lib/errors';
import { z } from 'zod';

const updateReferenceImageSchema = z.object({
  name: z.string().optional(),
});

// DELETE a reference image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    const imageId = await getRequiredParam(params, 'imageId');

    // Find the reference image
    const referenceImage = await prisma.referenceImage.findUnique({
      where: { id: imageId },
    });

    if (!referenceImage || referenceImage.projectId !== id) {
      throw new NotFoundError('Reference image', imageId);
    }

    // Delete from MinIO (continue even if this fails)
    try {
      await deleteImage(referenceImage.imageData);
    } catch (minioError) {
      logError(minioError, 'DELETE reference-image MinIO');
      // Continue with database deletion even if MinIO deletion fails
    }

    // Delete from database
    await prisma.referenceImage.delete({
      where: { id: imageId },
    });

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH update reference image name
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    const imageId = await getRequiredParam(params, 'imageId');
    const { name } = await validateRequestBody(request, updateReferenceImageSchema);

    // Verify the image belongs to this project
    const referenceImage = await prisma.referenceImage.findUnique({
      where: { id: imageId },
    });

    if (!referenceImage || referenceImage.projectId !== id) {
      throw new NotFoundError('Reference image', imageId);
    }

    // Update the name
    const updated = await prisma.referenceImage.update({
      where: { id: imageId },
      data: { name: name || null },
    });

    return successResponse({ referenceImage: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

