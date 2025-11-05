import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getImageUrl } from '@/lib/minio';
import { successResponse, errorResponse, getRequiredParam } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';

// GET export project data as JSON
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Get presigned URLs for all images
  const imagesWithUrls = await Promise.all(
    project.images.map(async (image) => ({
      ...image,
      imageUrl: await getImageUrl(image.imageData),
    }))
  );

  const referenceImagesWithUrls = await Promise.all(
    project.referenceImages.map(async (refImage) => ({
      ...refImage,
      imageUrl: await getImageUrl(refImage.imageData),
    }))
  );

  // Create export data with image URLs
  const exportData = {
    ...project,
    images: imagesWithUrls,
    referenceImages: referenceImagesWithUrls,
  };

  try {
    // Return project data as JSON for download
    const response = successResponse(exportData);
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="project-${project.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json"`
    );
    return response;
  } catch (error) {
    return errorResponse(error, 'Failed to export project');
  }
}

