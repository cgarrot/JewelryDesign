import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, validateRequestBody, getRequiredParam, withErrorHandling } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { z } from 'zod';

const updateSystemPromptSchema = z.object({
  systemPrompt: z.string().nullable(),
});

// GET: Retrieve the current project's custom system prompt
export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const id = await getRequiredParam(params, 'id');
  
  const project = await prisma.project.findUnique({
    where: { id },
    select: { customSystemPrompt: true },
  });

  if (!project) {
    throw new NotFoundError('Project', id);
  }

  return successResponse({
    systemPrompt: project.customSystemPrompt,
  });
});

// PUT: Update the project's custom system prompt
export const PUT = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const id = await getRequiredParam(params, 'id');
  const { systemPrompt } = await validateRequestBody(request, updateSystemPromptSchema);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new NotFoundError('Project', id);
  }

  const updatedProject = await prisma.project.update({
    where: { id },
    data: { customSystemPrompt: systemPrompt },
  });

  return successResponse({
    systemPrompt: updatedProject.customSystemPrompt,
  });
});

