import { NextRequest } from 'next/server';
import { getImageModel } from '@/lib/gemini';
import { prisma } from '@/lib/db';
import { uploadImage, getImageUrl, base64ToBuffer } from '@/lib/minio';
import { successResponse, validateRequestBody, withErrorHandling } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const generatePreviewSchema = z.object({
  materialId: z.string().min(1, 'Material ID is required'),
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { materialId } = await validateRequestBody(request, generatePreviewSchema);

  // Get material
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) {
    throw new NotFoundError('Material', materialId);
  }

  // Create enhanced prompt for material preview
  // Note: This route doesn't need JSON refactoring as it uses material prompts directly
  // (not from chat messages or LLM JSON responses)
  // Strip HTML tags from prompt
  const cleanPrompt = material.prompt.replace(/<[^>]*>/g, '');
  const enhancedPrompt = `Create a high-quality, professional preview image of a jewelry piece that demonstrates the following material/style/type: ${cleanPrompt}. The image should be clear, well-lit, on a neutral background, and showcase the characteristics described in the prompt. Make it visually appealing and representative of this material definition.`;

  // Call Gemini Image API
  const model = getImageModel();
  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: enhancedPrompt }],
      },
    ],
  });

  const response = result.response;

  // Extract image data from response
  const candidates = response.candidates;

  if (!candidates || candidates.length === 0) {
    throw new Error('No image generated from Gemini API');
  }

  // Extract the image from the response
  const imageData = candidates[0].content.parts.find(
    (part: { inlineData?: unknown }) => part.inlineData
  );

  if (!imageData || !imageData.inlineData) {
    throw new Error('No image data in Gemini API response');
  }

  // Convert base64 image to buffer
  const base64Image = `data:${imageData.inlineData.mimeType};base64,${imageData.inlineData.data}`;
  const { buffer } = base64ToBuffer(base64Image);

  // Generate unique image ID
  const imageId = randomBytes(16).toString('hex');

  // Upload to MinIO under materials folder
  const objectKey = await uploadImage(buffer, imageId, `materials/${materialId}`, 'image/png');

  // Update material with image data
  const updatedMaterial = await prisma.material.update({
    where: { id: materialId },
    data: {
      imageData: objectKey,
    },
  });

  // Get presigned URL for the uploaded image
  const imageUrl = await getImageUrl(objectKey);

  return successResponse({
    material: { ...updatedMaterial, imageUrl },
    imageUrl,
  });
});

