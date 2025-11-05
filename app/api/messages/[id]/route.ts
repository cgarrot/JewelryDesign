import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  validateRequestBody,
  withErrorHandling,
  getRequiredParam,
} from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { z } from 'zod';

const updateMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
});

// DELETE /api/messages/[id]
// Delete a single message
export const DELETE = withErrorHandling<{ params: Promise<{ id: string }> }>(
  async (
    request: NextRequest,
    context?: { params: Promise<{ id: string }> }
  ) => {
    if (!context) {
      throw new Error('Context is required');
    }
    const id = await getRequiredParam(context.params, 'id');

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundError('Message', id);
    }

    // Delete the message
    await prisma.message.delete({
      where: { id },
    });

    return successResponse({ success: true });
  }
);

// PATCH /api/messages/[id]
// Update message content
export const PATCH = withErrorHandling<{ params: Promise<{ id: string }> }>(
  async (
    request: NextRequest,
    context?: { params: Promise<{ id: string }> }
  ) => {
    if (!context) {
      throw new Error('Context is required');
    }
    const id = await getRequiredParam(context.params, 'id');
    const { content } = await validateRequestBody(request, updateMessageSchema);

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundError('Message', id);
    }

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id },
      data: { content },
    });

    return successResponse({ message: updatedMessage });
  }
);

