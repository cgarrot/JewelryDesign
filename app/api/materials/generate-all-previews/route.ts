import { NextRequest } from 'next/server';
import { getImageModel } from '@/lib/gemini';
import { prisma } from '@/lib/db';
import { uploadImage, getImageUrl, base64ToBuffer } from '@/lib/minio';
import { successResponse, withErrorHandling } from '@/lib/api-helpers';
import { logError } from '@/lib/errors';
import { randomBytes } from 'crypto';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Get all materials without preview images
  const materialsWithoutImages = await prisma.material.findMany({
    where: {
      OR: [
        { imageData: null },
        { imageData: '' },
      ],
    },
  });

  if (materialsWithoutImages.length === 0) {
    return successResponse({
      message: 'All materials already have preview images',
      generated: 0,
      total: 0,
    });
  }

  const results = {
    generated: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Process materials one by one (to avoid rate limits)
  for (const material of materialsWithoutImages) {
    try {
      // Create enhanced prompt for material preview
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
      const objectKey = await uploadImage(buffer, imageId, `materials/${material.id}`, 'image/png');

      // Update material with image data
      await prisma.material.update({
        where: { id: material.id },
        data: {
          imageData: objectKey,
        },
      });

      results.generated++;
    } catch (error) {
      logError(error, `generate-all-previews material ${material.id}`);
      results.failed++;
      results.errors.push(`${material.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return successResponse({
    message: `Generated ${results.generated} preview images. ${results.failed} failed.`,
    generated: results.generated,
    failed: results.failed,
    total: materialsWithoutImages.length,
    errors: results.errors,
  });
});

