import { NextRequest } from "next/server";
import { getChatModel, parseGenerationConfig } from "@/lib/gemini";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  successResponse,
  validateRequestBody,
  errorResponse,
} from "@/lib/api-helpers";
import { NotFoundError } from "@/lib/errors";
import { logError } from "@/lib/errors";
import type { GenerativeModel } from "@google/generative-ai";
import { z } from "zod";
import { calculateTotalCost } from "@/lib/pricing";
import { parseChatResponseJson, parseImageDecisionJson } from "@/lib/utils";
import type { ChatResponseJson } from "@/lib/types";
import { getImageBuffer } from "@/lib/minio";

const chatSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  message: z.string().min(1, "Message is required"),
  referenceImageIds: z.array(z.string()).optional(),
  generatedImageIds: z.array(z.string()).optional(),
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

// Helper function to send SSE data
function sendSSE(controller: ReadableStreamDefaultController, data: any) {
  const chunk = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(chunk));
}

export const POST = async (request: NextRequest) => {
  try {
    const { projectId, message, referenceImageIds, generatedImageIds } = await validateRequestBody(
      request,
      chatSchema
    );

    // Verify project exists and get custom system prompt with images
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        referenceImages: {
          where: referenceImageIds && referenceImageIds.length > 0
            ? { id: { in: referenceImageIds } }
            : undefined,
        },
        images: {
          where: generatedImageIds && generatedImageIds.length > 0
            ? { id: { in: generatedImageIds } }
            : undefined,
        },
      },
    });
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

    // Parse and use LLM parameters from project if available
    const generationConfig = parseGenerationConfig(project.llmParameters);

    // Prepare image parts for Gemini API
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    
    // Add reference images (up to 4 images supported by Gemini API)
    const selectedReferenceImages = project.referenceImages || [];
    for (const refImage of selectedReferenceImages.slice(0, 4)) {
      try {
        const imageBuffer = await getImageBuffer(refImage.imageData);
        const base64Data = imageBuffer.toString('base64');
        imageParts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        });
      } catch (error) {
        logError(error, 'chat-load-reference-image');
        // Continue with other images even if one fails
      }
    }
    
    // Add generated images (up to 4 total images with reference images)
    const selectedGeneratedImages = project.images || [];
    const remainingSlots = 4 - imageParts.length;
    for (const genImage of selectedGeneratedImages.slice(0, remainingSlots)) {
      try {
        const imageBuffer = await getImageBuffer(genImage.imageData);
        const base64Data = imageBuffer.toString('base64');
        imageParts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        });
      } catch (error) {
        logError(error, 'chat-load-generated-image');
        // Continue with other images even if one fails
      }
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Call Gemini API with streaming
          const model = getChatModel(generationConfig);
          
          // Build parts array with text and images
          const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
            {
              text: `${systemPrompt}\n\nConversation:\n${conversationHistory}`,
            },
          ];
          
          // Add image parts if any
          parts.push(...imageParts);
          
          // generateContentStream is async, so we need to await it
          const streamingResult = await model.generateContentStream({
            contents: [
              {
                role: "user",
                parts: parts as any, // Type assertion needed due to Gemini API type definitions
              },
            ],
          });

          let fullText = "";
          let fullResponse: any = null;
          let accumulatedJson = ""; // Accumulate JSON text for parsing
          let lastStreamedMessageLength = 0; // Track how much of the message we've already streamed

          // Helper function to extract message from streaming JSON
          // Handles partial JSON by finding the message field and extracting its value
          const extractMessageFromPartialJson = (
            jsonText: string
          ): string | null => {
            // First, try to parse as complete JSON
            try {
              const parsed = JSON.parse(jsonText);
              if (parsed.message && typeof parsed.message === "string") {
                return parsed.message;
              }
            } catch {
              // JSON is incomplete, extract message field manually
            }

            // Find the position of "message": "
            const messageKeyPattern = /"message"\s*:\s*"/;
            const keyMatch = jsonText.match(messageKeyPattern);

            if (!keyMatch) {
              return null; // Message field not found yet
            }

            // Start position of the message value (after the opening quote)
            const valueStartIndex = keyMatch.index! + keyMatch[0].length;
            const messageValue = jsonText.slice(valueStartIndex);

            if (!messageValue) {
              return null; // No value yet
            }

            // Extract the message value, handling escaped characters
            // We need to find the end of the string, accounting for escapes
            let extracted = "";
            let i = 0;
            let escaped = false;

            while (i < messageValue.length) {
              const char = messageValue[i];

              if (escaped) {
                // Handle escape sequences
                if (char === "n") {
                  extracted += "\n";
                } else if (char === "t") {
                  extracted += "\t";
                } else if (char === "r") {
                  extracted += "\r";
                } else if (char === "\\") {
                  extracted += "\\";
                } else if (char === '"') {
                  extracted += '"';
                } else {
                  extracted += "\\" + char; // Unknown escape, keep as is
                }
                escaped = false;
              } else if (char === "\\") {
                escaped = true;
              } else if (char === '"') {
                // Found the closing quote, message is complete
                break;
              } else {
                extracted += char;
              }

              i++;
            }

            // Return the extracted message (even if incomplete - no closing quote found yet)
            return extracted || null;
          };

          // Stream chunks as they arrive
          // According to the SDK, generateContentStream returns { stream, response }
          // The stream is an async iterable
          const stream = (streamingResult as any)?.stream;

          if (!stream) {
            const errorMsg = `Stream not accessible. Result keys: ${Object.keys(
              streamingResult as any
            ).join(", ")}`;
            logError(new Error(errorMsg), "chat-streaming");
            throw new Error(
              "Unable to access streaming response from Gemini API"
            );
          }

          // Verify it's iterable before using it
          if (typeof stream[Symbol.asyncIterator] !== "function") {
            const errorMsg = `Stream is not iterable. Type: ${typeof stream}`;
            logError(new Error(errorMsg), "chat-streaming");
            throw new Error("Stream from Gemini API is not iterable");
          }

          for await (const chunk of stream) {
            try {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                accumulatedJson += chunkText;

                // Try to extract message from accumulated JSON
                const currentMessage =
                  extractMessageFromPartialJson(accumulatedJson);

                if (
                  currentMessage &&
                  currentMessage.length > lastStreamedMessageLength
                ) {
                  // We have new message content to stream
                  const newMessageContent = currentMessage.slice(
                    lastStreamedMessageLength
                  );
                  if (newMessageContent) {
                    // Send only the new message text (not the raw JSON)
                    sendSSE(controller, {
                      type: "chunk",
                      text: newMessageContent,
                    });
                    lastStreamedMessageLength = currentMessage.length;
                  }
                }
              }
              // Store the chunk which contains the response
              fullResponse = chunk;
            } catch (chunkError) {
              logError(chunkError, "chat-streaming-chunk");
              // Continue processing other chunks
            }
          }

          // Get the complete response after streaming completes
          // The fullResponse should have the complete response object
          let response: any = null;
          if (fullResponse?.response) {
            response = fullResponse.response;
          } else if ((streamingResult as any).response) {
            // Try to get response from the streaming result
            const resultResponse = (streamingResult as any).response;
            response =
              typeof resultResponse.then === "function"
                ? await resultResponse
                : resultResponse;
          } else if (fullResponse) {
            // Use the last chunk as response
            response = fullResponse;
          }

          // Get the final text - prefer accumulated text over response.text()
          const responseText = fullText || response?.text?.() || "";

          // Try to parse as JSON first
          const parsedResponse = parseChatResponseJson(responseText);
          let assistantMessage: string;
          let contentJson: ChatResponseJson | null = null;
          let shouldGenerateImageFromJson = false;

          if (parsedResponse) {
            // Successfully parsed JSON
            assistantMessage = parsedResponse.message; // Use the formatted message from JSON
            contentJson = parsedResponse.json;
            shouldGenerateImageFromJson =
              parsedResponse.json.shouldGenerateImage;
          } else {
            // Fallback: Use text response as-is (backward compatibility)
            assistantMessage = responseText;
            logError(
              new Error("Failed to parse JSON response, using text fallback"),
              "chat-parse-json"
            );
          }

          // Extract usage metadata from main chat response
          const usageMetadata = response?.usageMetadata;
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
            const updatedProject = (await prisma.project.findUnique({
              where: { id: projectId },
            })) as any;
            if (updatedProject) {
              const newInputTokens =
                (updatedProject.totalInputTokens || 0) + inputTokens;
              const newOutputTokens =
                (updatedProject.totalOutputTokens || 0) + outputTokens;
              const newCost = calculateTotalCost(
                newInputTokens,
                newOutputTokens,
                updatedProject.totalImagesGenerated || 0
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

          // Send final message with metadata
          sendSSE(controller, {
            type: "done",
            message: assistantMessage,
            shouldGenerateImage: shouldGenerateImage,
          });

          controller.close();
        } catch (error) {
          logError(error, "chat-streaming");
          sendSSE(controller, {
            type: "error",
            error: error instanceof Error ? error.message : "An error occurred",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Handle validation/initialization errors before streaming starts
    return errorResponse(error);
  }
};
