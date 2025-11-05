import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { ChatResponseJson, ImageGenerationDecisionJson } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses JSON from LLM response text, handling code blocks and plain JSON
 */
export function parseJsonResponse<T>(text: string): T | null {
  try {
    // Try to parse as-is first
    return JSON.parse(text.trim()) as T;
  } catch {
    // If that fails, try to extract JSON from code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        return null;
      }
    }
    
    // Try to find JSON object in the text
    const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]) as T;
      } catch {
        return null;
      }
    }
    
    return null;
  }
}

/**
 * Validates and parses ChatResponseJson from LLM output
 */
export function parseChatResponseJson(text: string): { json: ChatResponseJson; message: string } | null {
  const parsed = parseJsonResponse<ChatResponseJson>(text);
  
  if (!parsed) {
    return null;
  }
  
  // Validate required fields
  if (!parsed.message || typeof parsed.message !== 'string') {
    return null;
  }
  
  if (!parsed.metadata || typeof parsed.metadata !== 'object') {
    return null;
  }
  
  if (typeof parsed.shouldGenerateImage !== 'boolean') {
    return null;
  }
  
  return {
    json: parsed,
    message: parsed.message, // This is the formatted markdown text for display
  };
}

/**
 * Validates and parses ImageGenerationDecisionJson from LLM output
 */
export function parseImageDecisionJson(text: string): ImageGenerationDecisionJson | null {
  const parsed = parseJsonResponse<ImageGenerationDecisionJson>(text);
  
  if (!parsed) {
    return null;
  }
  
  // Validate required field
  if (typeof parsed.shouldGenerate !== 'boolean') {
    return null;
  }
  
  return parsed;
}

