import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getImageUrl } from '@/lib/minio';
import { successResponse, validateRequestBody, withErrorHandling } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { z } from 'zod';

const createMaterialSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  category: z.string().min(1, 'Category is required'),
  isGlobal: z.boolean().default(false),
  projectId: z.string().optional(),
});

const updateMaterialSchema = z.object({
  id: z.string().min(1, 'Material ID is required'),
  name: z.string().optional(),
  prompt: z.string().optional(),
  category: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

// GET /api/materials?projectId={id}
// List materials (global + project-specific)
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  // Build where clause
  const where: any = {
    OR: [
      { isGlobal: true },
    ],
  };

  // Add project-specific materials if projectId is provided
  if (projectId) {
    where.OR.push({ projectId });
  }

  const materials = await prisma.material.findMany({
    where,
    orderBy: [
      { isGlobal: 'desc' }, // Global materials first
      { createdAt: 'desc' },
    ],
  });

  // Add presigned URLs for materials with images
  const materialsWithUrls = await Promise.all(
    materials.map(async (material) => {
      if (material.imageData) {
        try {
          const imageUrl = await getImageUrl(material.imageData);
          return { ...material, imageUrl };
        } catch (error) {
          // If image can't be loaded, continue without URL
          return material;
        }
      }
      return material;
    })
  );

  return successResponse({ materials: materialsWithUrls });
});

// POST /api/materials
// Create material
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { name, prompt, category, isGlobal, projectId } = await validateRequestBody(
    request,
    createMaterialSchema
  );

  // Validate that if not global, projectId must be provided
  if (!isGlobal && !projectId) {
    throw new Error('Project ID is required for project-specific materials');
  }

  // Validate that if global, projectId should not be provided
  if (isGlobal && projectId) {
    throw new Error('Global materials cannot be associated with a project');
  }

  const material = await prisma.material.create({
    data: {
      name,
      prompt,
      category,
      isGlobal,
      projectId: isGlobal ? null : projectId,
    },
  });

  return successResponse({ material });
});

// PATCH /api/materials
// Update material
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  const { id, name, prompt, category, isGlobal } = await validateRequestBody(
    request,
    updateMaterialSchema
  );

  // Check if material exists
  const existingMaterial = await prisma.material.findUnique({
    where: { id },
  });

  if (!existingMaterial) {
    throw new NotFoundError('Material', id);
  }

  // Build update data
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (prompt !== undefined) updateData.prompt = prompt;
  if (category !== undefined) updateData.category = category;
  if (isGlobal !== undefined) updateData.isGlobal = isGlobal;

  const material = await prisma.material.update({
    where: { id },
    data: updateData,
  });

  // Add presigned URL if material has an image
  let imageUrl;
  if (material.imageData) {
    try {
      imageUrl = await getImageUrl(material.imageData);
    } catch (error) {
      // Continue without URL if image can't be loaded
    }
  }

  return successResponse({ material: { ...material, imageUrl } });
});

// DELETE /api/materials?id={id}
// Delete material
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    throw new Error('Material ID is required');
  }

  // Check if material exists
  const existingMaterial = await prisma.material.findUnique({
    where: { id },
  });

  if (!existingMaterial) {
    throw new NotFoundError('Material', id);
  }

  await prisma.material.delete({
    where: { id },
  });

  return successResponse({ message: 'Material deleted successfully' });
});

