/**
 * Pricing calculations for Gemini 2.5 Flash Image API
 * Based on: https://ai.google.dev/pricing
 * 
 * Pricing (Paid Tier):
 * - Input: $0.30 per 1,000,000 tokens (text/image)
 * - Output (text): $0.30 per 1,000,000 tokens
 * - Output (images): $0.039 per image (each 1024x1024px image = 1290 tokens)
 */

const INPUT_PRICE_PER_MILLION_TOKENS = 0.30;
const OUTPUT_TEXT_PRICE_PER_MILLION_TOKENS = 0.30;
const OUTPUT_IMAGE_PRICE_PER_IMAGE = 0.039;
const TOKENS_PER_IMAGE = 1290;

/**
 * Calculate cost for chat/text generation (input + output tokens)
 */
export function calculateChatCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_MILLION_TOKENS;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_TEXT_PRICE_PER_MILLION_TOKENS;
  return inputCost + outputCost;
}

/**
 * Calculate cost for image generation
 * Each image costs $0.039 (regardless of input tokens used)
 */
export function calculateImageCost(imageCount: number): number {
  return imageCount * OUTPUT_IMAGE_PRICE_PER_IMAGE;
}

/**
 * Calculate total cost for a project
 */
export function calculateTotalCost(
  inputTokens: number,
  outputTokens: number,
  imageCount: number
): number {
  const chatCost = calculateChatCost(inputTokens, outputTokens);
  const imageCost = calculateImageCost(imageCount);
  return chatCost + imageCost;
}

/**
 * Format cost as currency string
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost);
}

/**
 * Get tokens equivalent for images (for display purposes)
 */
export function getImageTokens(imageCount: number): number {
  return imageCount * TOKENS_PER_IMAGE;
}

