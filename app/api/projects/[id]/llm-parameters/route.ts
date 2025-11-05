import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, validateRequestBody, getRequiredParam, withErrorHandling } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const updateLLMParametersSchema = z.object({
  llmParameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().int().min(1).optional(),
    maxOutputTokens: z.number().int().min(1).max(8192).optional(),
  }).optional().nullable(),
});

// GET: Retrieve the current project's LLM parameters
export const GET = withErrorHandling<{ params: Promise<{ id: string }> }>(async (
  request: NextRequest,
  context?: { params: Promise<{ id: string }> }
) => {
  if (!context) {
    throw new Error('Context is required');
  }
  const id = await getRequiredParam(context.params, 'id');
  
  const project = await prisma.project.findUnique({
    where: { id },
    select: { llmParameters: true },
  });

  if (!project) {
    throw new NotFoundError('Project', id);
  }

  return successResponse({
    llmParameters: project.llmParameters,
  });
});

// PUT: Update the project's LLM parameters
export const PUT = withErrorHandling<{ params: Promise<{ id: string }> }>(async (
  request: NextRequest,
  context?: { params: Promise<{ id: string }> }
) => {
  if (!context) {
    throw new Error('Context is required');
  }
  const id = await getRequiredParam(context.params, 'id');
  const { llmParameters } = await validateRequestBody(request, updateLLMParametersSchema);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new NotFoundError('Project', id);
  }

  // Convert to Prisma InputJsonValue, or JsonNull if empty
  const llmParamsJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = llmParameters && Object.keys(llmParameters).length > 0 
    ? (llmParameters as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  const updatedProject = await prisma.project.update({
    where: { id },
    data: { llmParameters: llmParamsJson },
  });

  return successResponse({
    llmParameters: updatedProject.llmParameters,
  });
});

