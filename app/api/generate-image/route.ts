import { NextRequest } from 'next/server';
import { getImageModel } from '@/lib/gemini';
import { prisma } from '@/lib/db';
import { uploadImage, getImageUrl, base64ToBuffer, getImageBuffer, imageFormatToMimeType } from '@/lib/minio';
import { successResponse, validateRequestBody, withErrorHandling } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { logError } from '@/lib/errors';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { calculateTotalCost } from '@/lib/pricing';
import type { ChatResponseJson, DesignSpecification } from '@/lib/types';

const generateImageSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  referenceImageIds: z.array(z.string()).optional(),
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { projectId, prompt, referenceImageIds } = await validateRequestBody(request, generateImageSchema);

  // Get project with reference images
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      referenceImages: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Get selected reference images (by IDs) with their metadata
  let selectedReferenceImages: Array<{ imageData: string; colorDescriptions?: Record<string, string> }> = [];
  let colorContextParts: string[] = [];
  
  if (referenceImageIds && Array.isArray(referenceImageIds) && referenceImageIds.length > 0) {
    // Use selected reference images
    selectedReferenceImages = project.referenceImages
      .filter(ref => referenceImageIds.includes(ref.id))
      .map(ref => {
        let colorDescriptions: Record<string, string> | undefined;
        // Parse color descriptions from name field if it's JSON
        if (ref.name) {
          try {
            const parsed = JSON.parse(ref.name);
            if (parsed.colorDescriptions && typeof parsed.colorDescriptions === 'object') {
              colorDescriptions = parsed.colorDescriptions;
            }
          } catch {
            // If parsing fails, name is not JSON, ignore
          }
        }
        return { imageData: ref.imageData, colorDescriptions };
      });
  } else if (project.referenceImages && project.referenceImages.length > 0) {
    // Use all reference images if none specified
    selectedReferenceImages = project.referenceImages.map(ref => {
      let colorDescriptions: Record<string, string> | undefined;
      // Parse color descriptions from name field if it's JSON
      if (ref.name) {
        try {
          const parsed = JSON.parse(ref.name);
          if (parsed.colorDescriptions && typeof parsed.colorDescriptions === 'object') {
            colorDescriptions = parsed.colorDescriptions;
          }
        } catch {
          // If parsing fails, name is not JSON, ignore
        }
      }
      return { imageData: ref.imageData, colorDescriptions };
    });
  }

  // Build color context from reference images
  selectedReferenceImages.forEach((ref) => {
    if (ref.colorDescriptions && Object.keys(ref.colorDescriptions).length > 0) {
      const descriptions = Object.entries(ref.colorDescriptions)
        .filter(([_, desc]) => desc.trim() !== '')
        .map(([color, desc]) => `${color} areas represent ${desc}`)
        .join(', ');
      if (descriptions) {
        colorContextParts.push(descriptions);
      }
    }
  });

  // Get conversation context for better image generation
  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    take: 10, // Last 10 messages for context
  });

  // Extract design specifications from JSON messages
  const designSpecs: DesignSpecification[] = [];
  let conversationContext = '';
  
  // Collect design specs from JSON messages
  messages.forEach((msg) => {
    if (msg.role === 'assistant' && msg.contentJson) {
      try {
        const jsonData = msg.contentJson as any;
        if (jsonData.metadata?.designSpec) {
          designSpecs.push(jsonData.metadata.designSpec);
        }
      } catch (error) {
        logError(error, 'generate-image parse designSpec');
      }
    }
    // Also collect text for fallback
    conversationContext += (conversationContext ? ' ' : '') + msg.content;
  });

  // Parse @ mentions from conversation to extract material references
  const mentionRegex = /@(\w+)/g;
  const mentionedMaterialNames = new Set<string>();
  
  // Extract all @ mentions from the conversation
  messages.forEach((msg) => {
    const matches = msg.content.matchAll(mentionRegex);
    for (const match of matches) {
      mentionedMaterialNames.add(match[1].toLowerCase());
    }
  });

  // Also extract from the current prompt
  const promptMatches = prompt.matchAll(mentionRegex);
  for (const match of promptMatches) {
    mentionedMaterialNames.add(match[1].toLowerCase());
  }

  // Fetch materials that match the mentioned names (global + project-specific)
  let materialPrompts: string[] = [];
  if (mentionedMaterialNames.size > 0) {
    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { isGlobal: true },
          { projectId },
        ],
        name: {
          in: Array.from(mentionedMaterialNames),
          mode: 'insensitive',
        },
      },
    });

    // Extract prompts from matched materials
    materialPrompts = materials.map((m) => {
      // Strip HTML tags from rich text prompt
      const cleanPrompt = m.prompt.replace(/<[^>]*>/g, '');
      return `${m.category}: ${cleanPrompt}`;
    });
  }

  // Get project image format and aspect ratio
  const projectFormat = project.imageFormat || 'PNG';
  const projectAspectRatio = project.imageAspectRatio || 'SQUARE';
  const formatMimeType = imageFormatToMimeType(projectFormat);
  
  // Format-specific prompt instructions
  const formatInstructions = {
    PNG: 'in PNG format',
    JPEG: 'in JPEG format',
    WEBP: 'in WebP format',
  };
  
  // Aspect ratio-specific prompt instructions
  const aspectRatioInstructions = {
    SQUARE: 'with a square aspect ratio (1:1)',
    HORIZONTAL: 'with a horizontal/landscape aspect ratio (16:9 or 4:3)',
    VERTICAL: 'with a vertical/portrait aspect ratio (9:16 or 3:4)',
  };
  
  // Build prompt from JSON design specs if available, otherwise use text
  let designDescription = '';
  
  if (designSpecs.length > 0) {
    // Merge all design specs into a comprehensive description
    const mergedSpec: DesignSpecification = {};
    
    designSpecs.forEach((spec) => {
      if (spec.type) mergedSpec.type = spec.type;
      if (spec.materials) {
        mergedSpec.materials = [...(mergedSpec.materials || []), ...spec.materials];
      }
      if (spec.style) mergedSpec.style = spec.style;
      if (spec.features) {
        mergedSpec.features = [...(mergedSpec.features || []), ...spec.features];
      }
      if (spec.gemstones) {
        mergedSpec.gemstones = [...(mergedSpec.gemstones || []), ...spec.gemstones];
      }
      if (spec.dimensions) mergedSpec.dimensions = spec.dimensions;
      if (spec.specialFeatures) {
        mergedSpec.specialFeatures = [...(mergedSpec.specialFeatures || []), ...spec.specialFeatures];
      }
    });
    
    // Build description from merged spec
    const parts: string[] = [];
    if (mergedSpec.type) parts.push(`a ${mergedSpec.type}`);
    if (mergedSpec.materials && mergedSpec.materials.length > 0) {
      parts.push(`made of ${mergedSpec.materials.join(', ')}`);
    }
    if (mergedSpec.style) parts.push(`in ${mergedSpec.style} style`);
    if (mergedSpec.gemstones && mergedSpec.gemstones.length > 0) {
      parts.push(`with ${mergedSpec.gemstones.join(', ')} gemstones`);
    }
    if (mergedSpec.features && mergedSpec.features.length > 0) {
      parts.push(`featuring ${mergedSpec.features.join(', ')}`);
    }
    if (mergedSpec.dimensions) parts.push(`dimensions: ${mergedSpec.dimensions}`);
    if (mergedSpec.specialFeatures && mergedSpec.specialFeatures.length > 0) {
      parts.push(`special features: ${mergedSpec.specialFeatures.join(', ')}`);
    }
    
    designDescription = parts.length > 0 ? parts.join(', ') : '';
  }
  
  // Build the enhanced prompt
  let enhancedPrompt = '';
  if (designDescription) {
    // Use JSON-based design description
    enhancedPrompt = `${prompt}. Design specifications: ${designDescription}. Create a high-quality, realistic image of this jewelry piece ${formatInstructions[projectFormat]} ${aspectRatioInstructions[projectAspectRatio]}. The image should be professional, well-lit, and showcase the jewelry design clearly on a neutral background.`;
  } else {
    // Fallback to text-based context
    enhancedPrompt = `${prompt}. Context from conversation: ${conversationContext}. Create a high-quality, realistic image of this jewelry piece ${formatInstructions[projectFormat]} ${aspectRatioInstructions[projectAspectRatio]}. The image should be professional, well-lit, and showcase the jewelry design clearly on a neutral background.`;
  }
  
  // Add material specifications to the prompt
  if (materialPrompts.length > 0) {
    const materialsContext = materialPrompts.join('. ');
    enhancedPrompt = `${enhancedPrompt} Material specifications: ${materialsContext}.`;
  }
  
  if (selectedReferenceImages.length > 0) {
    const imageText = selectedReferenceImages.length === 1 
      ? 'reference sketch/drawing' 
      : `${selectedReferenceImages.length} reference sketches/drawings`;
    enhancedPrompt = `Based on this ${imageText}, ${enhancedPrompt} Use the reference image(s) as a guide for the shape, style, and overall design of the jewelry piece.`;
    
    // Add color context if available
    if (colorContextParts.length > 0) {
      const colorContext = colorContextParts.join('. ');
      enhancedPrompt = `${enhancedPrompt} In the reference drawing: ${colorContext}.`;
    }
  }

  // Prepare parts for Gemini API
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: enhancedPrompt },
  ];

  // Add reference images (up to 4 images supported by Gemini API)
  // Note: We use imageData (MinIO key) from selectedReferenceImages, not the colorDescriptions
  for (const refImage of selectedReferenceImages.slice(0, 4)) {
    try {
      const imageBuffer = await getImageBuffer(refImage.imageData);
      const base64Data = imageBuffer.toString('base64');
      
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      });
    } catch (error) {
      logError(error, 'generate-image load reference');
      // Continue with other images even if one fails
    }
  }

  // Call Gemini Image API
  const model = getImageModel();
  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: parts as any, // Type assertion needed due to Gemini API type definitions
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

  // Use project's selected format (Gemini may return PNG, but we store with project format)
  // Note: If Gemini doesn't support the requested format natively, it will return PNG
  // In that case, we still use the project format for storage metadata
  const projectMimeType = formatMimeType;

  // Generate unique image ID
  const imageId = randomBytes(16).toString('hex');

  // Upload to MinIO with project's selected format
  const objectKey = await uploadImage(buffer, imageId, projectId, projectMimeType);

  // Extract usage metadata from image generation response
  const usageMetadata = response.usageMetadata;
  const inputTokens = usageMetadata?.promptTokenCount || 0;
  // Note: For images, output is billed per image ($0.039), not per token
  // Each image = 1290 tokens equivalent, but we bill by image count

  // Save generated image to database with MinIO object key
  const savedImage = await prisma.generatedImage.create({
    data: {
      projectId,
      imageData: objectKey,
      prompt: enhancedPrompt,
    },
  });

  // Update project usage
  const newInputTokens = (project.totalInputTokens || 0) + inputTokens;
  const newOutputTokens = project.totalOutputTokens || 0; // No change for images (billed per image)
  const newImagesGenerated = (project.totalImagesGenerated || 0) + 1;
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

  // Get presigned URL for the uploaded image
  const imageUrl = await getImageUrl(objectKey);

  return successResponse({
    imageId: savedImage.id,
    imageUrl: imageUrl,
  });
});

