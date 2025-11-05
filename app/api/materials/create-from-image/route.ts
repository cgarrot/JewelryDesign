import { NextRequest } from "next/server";
import { getChatModel } from "@/lib/gemini";
import { prisma } from "@/lib/db";
import { uploadImage, getImageUrl, base64ToBuffer } from "@/lib/minio";
import {
  successResponse,
  validateRequestBody,
  withErrorHandling,
} from "@/lib/api-helpers";
import { randomBytes } from "crypto";
import { z } from "zod";

const CATEGORIES = [
  "Material",
  "Type",
  "Style",
  "Shape",
  "Gemstone",
  "Technique",
  "Pattern",
  "Finish",
  "Other",
];

const createFromImageSchema = z.object({
  image: z.string().min(1, "Image is required"), // base64 image
  category: z.string().optional(),
  name: z.string().optional(),
  prompt: z.string().optional(), // User-provided prompt (if editing after analysis)
  isGlobal: z.boolean().default(false),
  projectId: z.string().optional(),
  preview: z.boolean().optional(), // If true, only return suggestions without creating material
});

// System prompt for analyzing jewelry/material images
const IMAGE_ANALYSIS_PROMPT = `You are an expert jewelry and material analyst. Analyze the provided image and extract detailed information about the jewelry piece, material, style, or design element shown.

Your task is to analyze the image and provide a comprehensive description that can be used as a material definition for jewelry design. Focus on:

1. **Material properties**: What materials are visible (metals, gemstones, textures, finishes)?
2. **Design characteristics**: Style, pattern, shape, technique, or visual features
3. **Visual details**: Colors, finishes, textures, surface treatments
4. **Application context**: How this material/style could be described for jewelry design

You MUST respond with ONLY a valid JSON object in this exact format:
{
  "name": "A concise, descriptive name for this material/style (e.g., 'Rose Gold with Diamond Accents', 'Art Deco Filigree Pattern', 'Matte Black Finish')",
  "category": "One of: Material, Type, Style, Shape, Gemstone, Technique, Pattern, Finish, Other",
  "prompt": "A detailed, rich text description suitable for image generation. Include specific material properties, visual characteristics, style elements, and design details. Use HTML formatting if needed (bold, italic, lists). This should be comprehensive enough to recreate similar jewelry pieces using this material definition."
}

The category should be one of: Material, Type, Style, Shape, Gemstone, Technique, Pattern, Finish, Other.
If you cannot determine the category, default to "Material".

The prompt should be detailed and descriptive, suitable for use in AI image generation to create jewelry pieces with similar characteristics.`;

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { image, category, name, prompt, isGlobal, projectId, preview } =
    await validateRequestBody(request, createFromImageSchema);

  // Convert base64 image to buffer
  const { buffer, mimeType } = base64ToBuffer(image);
  const base64Data = buffer.toString("base64");

  // Determine MIME type for Gemini (default to PNG if unknown)
  const geminiMimeType = mimeType || "image/png";

  // Prepare parts for Gemini API with image
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    { text: IMAGE_ANALYSIS_PROMPT },
    {
      inlineData: {
        mimeType: geminiMimeType,
        data: base64Data,
      },
    },
  ];

  // Call Gemini Chat API with vision
  const model = getChatModel();
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: parts as any, // Type assertion needed due to Gemini API type definitions
      },
    ],
  });

  const response = result.response;
  const responseText = response.text();

  // Parse JSON response
  let analysisResult: { name: string; category: string; prompt: string };
  try {
    // Try to extract JSON from response (might be wrapped in markdown code blocks)
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      jsonText = jsonText
        .replace(/^```(?:json)?\n?/g, "")
        .replace(/\n?```$/g, "");
    }

    analysisResult = JSON.parse(jsonText);

    // Validate required fields
    if (
      !analysisResult.name ||
      !analysisResult.category ||
      !analysisResult.prompt
    ) {
      throw new Error("Invalid response format: missing required fields");
    }

    // Validate category
    if (!CATEGORIES.includes(analysisResult.category)) {
      analysisResult.category = "Material"; // Default to Material if invalid
    }
  } catch (error) {
    // Fallback: create a basic material description
    console.error("Failed to parse Gemini response:", error);
    analysisResult = {
      name: name || "Material from Image",
      category: category || "Material",
      prompt: `A jewelry material or design element based on the uploaded image. Analyze the visual characteristics, materials, style, and design elements visible in the image.`,
    };
  }

  // Use provided values or AI-suggested values
  // If user provided a prompt (e.g., after editing), use it; otherwise use AI-generated prompt
  const materialName = name || analysisResult.name;
  const materialCategory = category || analysisResult.category;
  const materialPrompt = prompt || analysisResult.prompt; // Use user-provided prompt if available

  // If preview mode, just return suggestions without creating
  if (preview) {
    return successResponse({
      suggestions: {
        name: materialName,
        category: materialCategory,
        prompt: materialPrompt,
      },
    });
  }

  // Validate that if not global, projectId must be provided (only needed when creating)
  if (!isGlobal && !projectId) {
    throw new Error("Project ID is required for project-specific materials");
  }

  // Validate that if global, projectId should not be provided (only needed when creating)
  if (isGlobal && projectId) {
    throw new Error("Global materials cannot be associated with a project");
  }

  // Generate unique material ID first (we'll use it for the folder structure)
  const materialId = randomBytes(16).toString("hex");
  const imageId = randomBytes(16).toString("hex");

  // Upload image to MinIO under materials folder
  const objectKey = await uploadImage(
    buffer,
    imageId,
    `materials/${materialId}`,
    mimeType
  );

  // Create material record
  const material = await prisma.material.create({
    data: {
      name: materialName,
      prompt: materialPrompt,
      category: materialCategory,
      imageData: objectKey, // Store the uploaded image as preview
      isGlobal,
      projectId: isGlobal ? null : projectId,
    },
  });

  // Get presigned URL for the uploaded image
  const imageUrl = await getImageUrl(objectKey);

  return successResponse({
    material: { ...material, imageUrl },
  });
});
