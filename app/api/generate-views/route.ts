import { NextRequest } from 'next/server';
import { getImageModel } from '@/lib/gemini';
import { prisma } from '@/lib/db';
import { uploadImage, getImageUrl, base64ToBuffer, getImageBuffer, imageFormatToMimeType } from '@/lib/minio';
import { successResponse, validateRequestBody, withErrorHandling } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { logError } from '@/lib/errors';
import { randomBytes, randomUUID } from 'crypto';
import { z } from 'zod';
import { calculateTotalCost } from '@/lib/pricing';

const generateViewsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  baseImageId: z.string().optional(), // Optional, defaults to most recent image
});

const VIEW_TYPES = ['FRONT', 'SIDE', 'TOP', 'BOTTOM'] as const;
type ViewType = typeof VIEW_TYPES[number];

const VIEW_PROMPT_MODIFIERS: Record<ViewType, string> = {
  FRONT: 'direct front view, eye-level perspective, facing the camera head-on, showing the main design elements and the front face of the jewelry piece. Focus on the primary design features and the upper part of the piece that would be visible from the front',
  SIDE: 'perfect side profile view, showing the jewelry piece from a 90-degree side angle. Emphasize the thickness, depth, and structural details of the piece. Show the ring\'s silhouette and profile clearly, highlighting how the design elements connect and the tapering of the band',
  TOP: 'direct overhead view, looking straight down at the jewelry piece from directly above, bird\'s eye perspective. Clearly display the full top design, all decorative elements visible from above, and the top curvature of the band or structure. Show the complete top surface without any tilt or angle',
  BOTTOM: 'clear bottom view, looking up into the jewelry piece\'s interior and underside. Show the hollowed-out underside, the complete inner circumference of the band, and any structural details visible from below. Emphasize the interior construction and the reverse side of the design elements',
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { projectId, baseImageId } = await validateRequestBody(request, generateViewsSchema);

  // Get project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Get the base image (most recent or specified)
  let baseImage;
  if (baseImageId) {
    baseImage = await prisma.generatedImage.findFirst({
      where: {
        id: baseImageId,
        projectId,
        viewType: null, // Only get regular images, not other views
      },
    });
  } else {
    // Get most recent generated image (excluding views)
    baseImage = await prisma.generatedImage.findFirst({
      where: {
        projectId,
        viewType: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  if (!baseImage) {
    throw new NotFoundError('Base image', 'No generated images found for this project');
  }

  // Get conversation context for better image generation (optional, mainly for fallback)
  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  // Note: Views are generated from the base image prompt, which already contains the design information
  // The base image prompt is used directly, so we don't need to extract JSON design specs here
  const conversationContext = messages.map((msg) => msg.content).join(' ');

  // Get project image format and aspect ratio
  const projectFormat = project.imageFormat || 'PNG';
  const projectAspectRatio = project.imageAspectRatio || 'SQUARE';
  const formatMimeType = imageFormatToMimeType(projectFormat);

  const formatInstructions = {
    PNG: 'in PNG format',
    JPEG: 'in JPEG format',
    WEBP: 'in WebP format',
  };

  const aspectRatioInstructions = {
    SQUARE: 'with a square aspect ratio (1:1)',
    HORIZONTAL: 'with a horizontal/landscape aspect ratio (16:9 or 4:3)',
    VERTICAL: 'with a vertical/portrait aspect ratio (9:16 or 3:4)',
  };

  // Get base image buffer
  let baseImageBuffer: Buffer;
  try {
    baseImageBuffer = await getImageBuffer(baseImage.imageData);
  } catch (error) {
    logError(error, 'generate-views load base image');
    throw new Error('Failed to load base image');
  }

  const base64BaseImage = baseImageBuffer.toString('base64');

  // Generate a unique viewSetId to group all 4 views
  const viewSetId = randomUUID();

  // Generate all 4 views
  const model = getImageModel();
  const generatedViews = [];
  let totalInputTokens = 0;

  for (const viewType of VIEW_TYPES) {
    try {
      // Build view-specific prompt
      const viewModifier = VIEW_PROMPT_MODIFIERS[viewType];
      // Clean the base prompt - remove any existing view references and context instructions
      const basePrompt = baseImage.prompt
        .replace(/\.\s*(front|side|top|bottom|view|perspective).*$/i, '')
        .replace(/Context from conversation:.*$/i, '')
        .replace(/Create a high-quality.*$/i, '')
        .trim();
      
      const enhancedPrompt = `${basePrompt}. Create a high-quality, realistic, professional jewelry photography image ${formatInstructions[projectFormat]} ${aspectRatioInstructions[projectAspectRatio]}. This must be a ${viewModifier}. The image should use professional studio lighting with soft, even illumination that highlights all design details. The jewelry should be displayed on a neutral, clean background (light gray or white surface). Maintain the exact same design, materials, colors, and decorative elements as shown in the reference image, but render the piece from this specific viewing angle. The perspective must be accurate and true to the ${viewType.toLowerCase()} view specification.`;

      // Prepare parts for Gemini API with base image as reference
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: enhancedPrompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64BaseImage,
          },
        },
      ];

      // Call Gemini Image API
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: parts as any,
          },
        ],
      });

      const response = result.response;
      
      // Track input tokens for this view
      const usageMetadata = response.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount || 0;
      totalInputTokens += inputTokens;
      
      const candidates = response.candidates;

      if (!candidates || candidates.length === 0) {
        logError(new Error('No image generated'), 'generate-views view generation');
        continue;
      }

      // Extract the image from the response
      const imageData = candidates[0].content.parts.find(
        (part: { inlineData?: unknown }) => part.inlineData
      );

      if (!imageData || !imageData.inlineData) {
        logError(new Error('No image data in Gemini API response'), 'generate-views view extraction');
        continue;
      }

      // Convert base64 image to buffer
      const base64Image = `data:${imageData.inlineData.mimeType};base64,${imageData.inlineData.data}`;
      const { buffer } = base64ToBuffer(base64Image);

      // Generate unique image ID
      const imageId = randomBytes(16).toString('hex');

      // Upload to MinIO
      const objectKey = await uploadImage(buffer, imageId, projectId, formatMimeType);

      // Save generated view to database
      const savedImage = await prisma.generatedImage.create({
        data: {
          projectId,
          imageData: objectKey,
          prompt: enhancedPrompt,
          viewType: viewType,
          viewSetId: viewSetId,
        },
      });

      // Get presigned URL
      const imageUrl = await getImageUrl(objectKey);

      generatedViews.push({
        id: savedImage.id,
        viewType: viewType,
        imageUrl: imageUrl,
      });
    } catch (error) {
      logError(error, `generate-views view ${viewType}`);
      // Continue with other views even if one fails
    }
  }

  if (generatedViews.length === 0) {
    throw new Error('Failed to generate any views');
  }

  // Update project usage - 4 images generated, plus input tokens
  const project = await prisma.project.findUnique({ where: { id: projectId } }) as any;
  if (project) {
    const newInputTokens = (project.totalInputTokens || 0) + totalInputTokens;
    const newOutputTokens = project.totalOutputTokens || 0; // No change for images (billed per image)
    const newImagesGenerated = (project.totalImagesGenerated || 0) + generatedViews.length;
    const newCost = calculateTotalCost(
      newInputTokens,
      newOutputTokens,
      newImagesGenerated
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        totalInputTokens: newInputTokens,
        totalImagesGenerated: newImagesGenerated,
        totalCost: newCost,
      } as any, // Type assertion needed until Prisma types are regenerated
    });
  }

  return successResponse({
    views: generatedViews,
    viewSetId: viewSetId,
  });
});

