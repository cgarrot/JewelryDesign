import { NextRequest } from "next/server";
import { getChatModel } from "@/lib/gemini";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  successResponse,
  validateRequestBody,
  withErrorHandling,
} from "@/lib/api-helpers";
import { NotFoundError } from "@/lib/errors";
import { logError } from "@/lib/errors";
import type { GenerativeModel } from "@google/generative-ai";
import { z } from "zod";
import { calculateTotalCost } from "@/lib/pricing";
import { parseChatResponseJson, parseImageDecisionJson } from "@/lib/utils";
import type { ChatResponseJson } from "@/lib/types";

const chatSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  message: z.string().min(1, "Message is required"),
});

async function determineIfShouldGenerateImage(
  conversationHistory: string,
  assistantMessage: string,
  chatResponseJson: ChatResponseJson | null,
  model: GenerativeModel,
  projectId: string
): Promise<{
  shouldGenerate: boolean;
  inputTokens: number;
  outputTokens: number;
}> {
  try {
    // If we have structured JSON, use the shouldGenerateImage field directly
    if (
      chatResponseJson &&
      typeof chatResponseJson.shouldGenerateImage === "boolean"
    ) {
      return {
        shouldGenerate: chatResponseJson.shouldGenerateImage,
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    // Fallback: Use LLM to determine if image generation should happen
    const decisionPrompt = `Analyze the following conversation about jewelry design and determine if there is enough information to generate an image.

Conversation:
${conversationHistory}

Assistant's latest response:
${assistantMessage}

Consider the following:
1. Does the conversation contain sufficient details about the jewelry piece (type, materials, style, features)?
2. Has the user expressed satisfaction or confirmation with the design description?
3. Is the design description complete enough to visualize?
4. Would generating an image at this point be helpful and appropriate?

You must respond with ONLY a valid JSON object in this exact format:
{
  "shouldGenerate": true or false,
  "reasoning": "brief explanation"
}`;

    const decisionResult = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: decisionPrompt }],
        },
      ],
    });

    const decisionText = decisionResult.response.text();
    const parsedDecision = parseImageDecisionJson(decisionText);

    let shouldGenerate = false;
    if (parsedDecision) {
      shouldGenerate = parsedDecision.shouldGenerate;
    } else {
      // Fallback: Try to parse as text (backward compatibility)
      const upperText = decisionText.trim().toUpperCase();
      shouldGenerate =
        upperText.includes("YES") ||
        upperText.includes('"shouldGenerate":true');
    }

    // Extract usage metadata
    const usageMetadata = decisionResult.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Update project usage
    if (inputTokens > 0 || outputTokens > 0) {
      const project = (await prisma.project.findUnique({
        where: { id: projectId },
      })) as any;
      if (project) {
        const newInputTokens = (project.totalInputTokens || 0) + inputTokens;
        const newOutputTokens = (project.totalOutputTokens || 0) + outputTokens;
        const newCost = calculateTotalCost(
          newInputTokens,
          newOutputTokens,
          project.totalImagesGenerated || 0
        );

        await prisma.project.update({
          where: { id: projectId },
          data: {
            totalInputTokens: newInputTokens,
            totalOutputTokens: newOutputTokens,
            totalCost: newCost,
          } as any, // Type assertion needed until Prisma types are regenerated
        });
      }
    }

    return { shouldGenerate, inputTokens, outputTokens };
  } catch (error) {
    logError(error, "determineIfShouldGenerateImage");
    // Default to false if there's an error
    return { shouldGenerate: false, inputTokens: 0, outputTokens: 0 };
  }
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { projectId, message } = await validateRequestBody(request, chatSchema);

  // Verify project exists and get custom system prompt
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError("Project", projectId);
  }

  // Save user message
  await prisma.message.create({
    data: {
      projectId,
      role: "user",
      content: message,
    },
  });

  // Get conversation history
  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  // Build conversation context for Gemini
  const conversationHistory = messages
    .map(
      (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
    )
    .join("\n");

  // Use custom system prompt if available, otherwise use default
  const defaultSystemPrompt = `You are a helpful jewelry design assistant. You help users design custom jewelry pieces by having a conversation about their preferences, style, materials, and desired features. 

When the user describes a jewelry piece, provide thoughtful suggestions and ask clarifying questions using a structured format with multiple-choice options (a, b, c). Present each question with clear options, ensuring each option is on its own line. CRITICAL: Each question must have exactly 3 options (a, b, c) - never more than 3.

CRITICAL LIMIT: NEVER ask more than 3 questions at once. If you need to gather more information, ask 2-3 questions first, wait for the user's response, then ask additional questions in a follow-up message. This prevents overwhelming the user.

IMPORTANT FORMATTING: 
- ALWAYS use Markdown formatting for better structure and readability
- Use **bold text** for question titles and important terms
- ALWAYS number question titles sequentially (1., 2., 3., etc.) to make them easier to reference
- Use a single line break between each option, and double line breaks (blank lines) between different questions/sections
- Structure your responses clearly with markdown formatting

Example format (use exactly this spacing and markdown):
**1. Type of jewelry:**
a) Ring
b) Necklace
c) Earrings

**2. Material preference:**
a) Gold (yellow, white, or rose)
b) Silver
c) Platinum

**3. Style preference:**
a) Modern and minimalist
b) Vintage/antique
c) Art Deco

When asking about specific aspects, always present options in this format with numbered question titles (1., 2., 3., etc.) and exactly 3 options (a, b, c), using proper markdown formatting (use **bold** for numbered question titles, single line breaks between options, double line breaks between questions) rather than asking open-ended questions. This makes it easier for users to make decisions quickly and read the options clearly. NEVER provide more than 3 options per question.

Use markdown formatting throughout your responses:
- **Bold** for emphasis and numbered question titles (e.g., **1. Question title:**)
- Lists with proper markdown syntax (- or *) for bullet points
- Clear structure with proper line breaks
- Always number sequential questions (1., 2., 3., etc.)

Focus on these key aspects:
- Type of jewelry
- Materials
- Gemstones
- Style
- Special features or engravings

When the user seems satisfied with the design description, encourage them to generate an image by suggesting: "Would you like me to generate an image of this design?"

Keep responses concise and friendly. Focus on jewelry design aspects. Always use markdown formatting to make your responses well-structured and easy to read.

CRITICAL: You MUST respond with ONLY a valid JSON object. The JSON must have this exact structure:
{
  "message": "Your full markdown-formatted message text here (same format as before, with all the formatting, questions, and options)",
  "metadata": {
    "type": "question" | "suggestion" | "confirmation" | "info",
    "questions": [
      {
        "id": "unique-id",
        "title": "Question title",
        "options": [
          {"id": "a", "label": "Option a"},
          {"id": "b", "label": "Option b"}
        ]
      }
    ],
    "designSpec": {
      "type": "ring" | "necklace" | etc.,
      "materials": ["gold", "silver"],
      "style": "modern",
      "features": ["feature1"],
      "gemstones": ["diamond"],
      "specialFeatures": ["engraving"]
    }
  },
  "shouldGenerateImage": true or false
}

The "message" field should contain the exact same formatted markdown text you would have sent before - with all the questions, options, and formatting. The metadata is for internal processing only.`;

  const systemPrompt = project.customSystemPrompt || defaultSystemPrompt;

  // Call Gemini API
  const model = getChatModel();
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nConversation:\n${conversationHistory}`,
          },
        ],
      },
    ],
  });

  const response = result.response;
  const responseText = response.text();

  // Try to parse as JSON first
  const parsedResponse = parseChatResponseJson(responseText);
  let assistantMessage: string;
  let contentJson: ChatResponseJson | null = null;
  let shouldGenerateImageFromJson = false;

  if (parsedResponse) {
    // Successfully parsed JSON
    assistantMessage = parsedResponse.message; // Use the formatted message from JSON
    contentJson = parsedResponse.json;
    shouldGenerateImageFromJson = parsedResponse.json.shouldGenerateImage;
  } else {
    // Fallback: Use text response as-is (backward compatibility)
    assistantMessage = responseText;
    logError(
      new Error("Failed to parse JSON response, using text fallback"),
      "chat-parse-json"
    );
  }

  // Extract usage metadata from main chat response
  const usageMetadata = response.usageMetadata;
  const inputTokens = usageMetadata?.promptTokenCount || 0;
  const outputTokens = usageMetadata?.candidatesTokenCount || 0;

  // Save assistant message with both content (text) and contentJson (structured data)
  await prisma.message.create({
    data: {
      projectId,
      role: "assistant",
      content: assistantMessage, // Always store the text for display
      contentJson: contentJson
        ? (contentJson as unknown as Prisma.JsonValue)
        : null, // Store JSON for internal processing
    } as Prisma.MessageUncheckedCreateInput,
  });

  // Update project usage for main chat call
  if (inputTokens > 0 || outputTokens > 0) {
    const project = (await prisma.project.findUnique({
      where: { id: projectId },
    })) as any;
    if (project) {
      const newInputTokens = (project.totalInputTokens || 0) + inputTokens;
      const newOutputTokens = (project.totalOutputTokens || 0) + outputTokens;
      const newCost = calculateTotalCost(
        newInputTokens,
        newOutputTokens,
        project.totalImagesGenerated || 0
      );

      await prisma.project.update({
        where: { id: projectId },
        data: {
          totalInputTokens: newInputTokens,
          totalOutputTokens: newOutputTokens,
          totalCost: newCost,
        } as any, // Type assertion needed until Prisma types are regenerated
      });
    }
  }

  // Determine if image generation should happen
  // If we have JSON with shouldGenerateImage, use it directly; otherwise use the decision function
  let shouldGenerateImage = shouldGenerateImageFromJson;
  if (!parsedResponse) {
    // Fallback: Use LLM to determine if image generation should happen
    const decisionResult = await determineIfShouldGenerateImage(
      conversationHistory,
      assistantMessage,
      null, // No JSON available
      model,
      projectId
    );
    shouldGenerateImage = decisionResult.shouldGenerate;
  }

  return successResponse({
    message: assistantMessage, // Same text format as before
    shouldGenerateImage: shouldGenerateImage,
  });
});
