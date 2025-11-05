import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadImage, getImageUrl, base64ToBuffer } from '@/lib/minio';
import { successResponse, errorResponse, validateRequestBody, getRequiredParam } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const uploadReferenceImageSchema = z.object({
  referenceImage: z.string().min(1, 'Reference image is required'),
  name: z.string().optional(),
  colorDescriptions: z.record(z.string()).optional(),
});

// GET all reference images for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError('Project', id);
    }

    const referenceImages = await prisma.referenceImage.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Get presigned URLs for all images
    const imagesWithUrls = await Promise.all(
      referenceImages.map(async (image) => ({
        ...image,
        imageUrl: await getImageUrl(image.imageData),
      }))
    );

    return successResponse({ referenceImages: imagesWithUrls });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST upload a new reference image
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    const { referenceImage, name, colorDescriptions } = await validateRequestBody(request, uploadReferenceImageSchema);

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError('Project', id);
    }

    // Convert base64 to buffer and upload to MinIO
    const { buffer, mimeType } = base64ToBuffer(referenceImage);
    const imageId = `ref-${randomBytes(16).toString('hex')}`;
    const objectKey = await uploadImage(buffer, imageId, id, mimeType);

    // Build name field: if name provided, use it; otherwise store colorDescriptions as JSON
    let nameField: string | null = name || null;
    if (!name && colorDescriptions && Object.keys(colorDescriptions).length > 0) {
      // Store color descriptions as JSON string in name field
      nameField = JSON.stringify({ colorDescriptions });
    } else if (name && colorDescriptions && Object.keys(colorDescriptions).length > 0) {
      // If both name and colorDescriptions exist, combine them
      nameField = JSON.stringify({ name, colorDescriptions });
    }

    // Save to database
    const referenceImageRecord = await prisma.referenceImage.create({
      data: {
        projectId: id,
        imageData: objectKey,
        name: nameField,
      },
    });

    // Get presigned URL for the uploaded image
    const imageUrl = await getImageUrl(objectKey);

    return successResponse({
      referenceImage: {
        ...referenceImageRecord,
        imageUrl,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

