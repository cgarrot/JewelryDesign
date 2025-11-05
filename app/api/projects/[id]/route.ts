import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getImageUrl } from '@/lib/minio';
import { successResponse, errorResponse, validateRequestBody, getRequiredParam } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
});

// GET single project with all messages and images
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        images: {
          orderBy: { createdAt: 'desc' },
        },
        referenceImages: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project', id);
    }

    // Convert MinIO object keys to presigned URLs
    const imagesWithUrls = await Promise.all(
      project.images.map(async (image) => ({
        ...image,
        imageData: await getImageUrl(image.imageData),
      }))
    );

    const referenceImagesWithUrls = await Promise.all(
      project.referenceImages.map(async (refImage) => ({
        ...refImage,
        imageUrl: await getImageUrl(refImage.imageData),
      }))
    );

    const projectWithUrls = {
      ...project,
      images: imagesWithUrls,
      referenceImages: referenceImagesWithUrls,
    };

    return successResponse({ project: projectWithUrls });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await getRequiredParam(params, 'id');
    const { name } = await validateRequestBody(request, updateProjectSchema);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError('Project', id);
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { name },
    });

    return successResponse({ project: updatedProject });
  } catch (error) {
    return errorResponse(error);
  }
}

